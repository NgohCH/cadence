import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  Suspense,
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import {
  apiFetch,
} from '../../lib/api'

import type {
  ApiSuccess,
} from '../../types/api'

import type {
  DiscussionMessage,
} from '../../types/discussion'

import {
  DiscussionPanel,
} from './DiscussionPanel'


vi.mock(
  '../../lib/api',
  async () => ({
    ...(await vi.importActual('../../lib/api')),
    apiFetch: vi.fn(),
  }),
)


const currentUserId = 'user-current'


function message(
  overrides: Partial<DiscussionMessage> = {},
): DiscussionMessage {
  return {
    id: 'message-1',
    project_id: 'project-a',
    author_user_id: currentUserId,
    author_type: 'human',
    thread_parent_id: null,
    current_version: 1,
    content: 'Persisted message',
    created_at: '2026-08-31T09:00:00.000Z',
    edited_at: null,
    ...overrides,
  }
}


function success(
  messages: DiscussionMessage[],
): ApiSuccess<{ messages: DiscussionMessage[] }> {
  return {
    success: true,
    data: {
      messages,
    },
    meta: {
      correlation_id: 'correlation-1',
      request_id: 'request-1',
      next_cursor: null,
    },
  }
}


function renderPanel(
  projectId = 'project-a',
) {
  return render(
    <DiscussionPanel
      currentUserId={currentUserId}
      projectId={projectId}
    />,
  )
}


beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
  vi.mocked(apiFetch).mockResolvedValue(
    success([]),
  )
})


afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})


describe('VS003 Stage 4 DiscussionPanel', () => {
  it('requests persisted messages for the project on initial mount', async () => {
    renderPanel('project-a')

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/projects/project-a/messages',
      )
    })
  })

  it('shows a loading state while the initial persisted read is pending', () => {
    vi.mocked(apiFetch).mockReturnValue(
      new Promise(() => undefined),
    )

    renderPanel()

    expect(
      screen.getByText('Loading Discussion messages...'),
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('renders persisted messages in the order returned by the API', async () => {
    const first = message({
      id: 'message-first',
      content: 'First persisted message',
    })
    const second = message({
      id: 'message-second',
      content: 'Second persisted message',
    })
    vi.mocked(apiFetch).mockResolvedValue(
      success([first, second]),
    )

    renderPanel()

    const firstMessage = await screen.findByText(
      'First persisted message',
    )
    const secondMessage = screen.getByText(
      'Second persisted message',
    )

    expect(
      firstMessage.compareDocumentPosition(secondMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows a persisted empty state after an empty successful read', async () => {
    renderPanel()

    expect(
      await screen.findByText('No persisted Discussion messages yet.'),
    ).toBeTruthy()
    expect(
      screen.queryByText(/this browser session/i),
    ).toBeNull()
  })

  it('shows a distinct read error when the persisted read fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new Error('Discussion read unavailable'),
    )

    renderPanel()

    expect(
      await screen.findByText(
        'Unable to load persisted Discussion messages: Discussion read unavailable',
      ),
    ).toBeTruthy()
  })

  it('does not present a read failure as a successful empty Discussion', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new Error('Read denied'),
    )

    renderPanel()

    await screen.findByText(
      'Unable to load persisted Discussion messages: Read denied',
    )

    expect(
      screen.queryByText('No persisted Discussion messages yet.'),
    ).toBeNull()
  })

  it('labels the current human author as You', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      success([message()]),
    )

    renderPanel()

    expect(await screen.findByText('You')).toBeTruthy()
  })

  it('labels another human with a stable short identifier', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      success([
        message({
          author_user_id: 'participant-456789',
          content: 'A participant message',
        }),
      ]),
    )

    renderPanel()

    const author = await screen.findByText(
      'Participant participant',
    )
    expect(author.getAttribute('title')).toBe(
      'participant-456789',
    )
  })

  it('distinguishes agent and system authors', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      success([
        message({
          id: 'agent-message',
          author_user_id: null,
          author_type: 'agent',
          content: 'Agent message',
        }),
        message({
          id: 'system-message',
          author_user_id: null,
          author_type: 'system',
          content: 'System message',
        }),
      ]),
    )

    renderPanel()

    expect(await screen.findByText('Team Agent')).toBeTruthy()
    expect(screen.getByText('System')).toBeTruthy()
  })

  it('renders each committed message timestamp', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      success([message()]),
    )

    renderPanel()

    const timestamp = await screen.findByRole('time')
    expect(timestamp.getAttribute('dateTime')).toBe(
      '2026-08-31T09:00:00.000Z',
    )
  })

  it('appends the committed message returned by a successful POST', async () => {
    const posted = message({
      id: 'posted-message',
      content: 'Posted from the composer',
    })
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce({
        success: true,
        data: posted,
        meta: success([]).meta,
      })

    renderPanel()
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      '  Posted from the composer  ',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Posted from the composer')).toBeTruthy()
    expect(apiFetch).toHaveBeenLastCalledWith(
      '/api/v1/projects/project-a/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: 'Posted from the composer',
          thread_parent_id: null,
        }),
      }),
    )
  })

  it('keeps a POST error separate from the persisted read state', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockRejectedValueOnce(new Error('Post failed'))

    renderPanel()
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Message that fails',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Post failed')).toBeTruthy()
    expect(
      screen.queryByText(/Unable to load persisted Discussion messages/i),
    ).toBeNull()
    expect(
      screen.queryByText('No persisted Discussion messages yet.'),
    ).toBeTruthy()
  })

  it('does not append a Project A POST completion after switching to Project B', async () => {
    let resolvePost: (
      value: ApiSuccess<DiscussionMessage>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )
      .mockResolvedValueOnce(success([]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A post',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await screen.findByText('No persisted Discussion messages yet.')

    await act(async () => {
      resolvePost({
        success: true,
        data: message({
          id: 'project-a-post',
          content: 'Project A post',
        }),
        meta: success([]).meta,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      document.querySelector('.message-list')?.textContent ?? '',
    ).not.toContain('Project A post')
    expect(
      screen.getByText('No persisted Discussion messages yet.'),
    ).toBeTruthy()
  })

  it('does not leak a stale Project A POST failure into Project B', async () => {
    let rejectPost: (
      reason?: unknown,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectPost = reject
        }),
      )
      .mockResolvedValueOnce(success([]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A draft',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(3)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    await act(async () => {
      rejectPost(new Error('Project A POST failed'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('Project A POST failed')).toBeNull()
    expect(
      (screen.getByPlaceholderText('Write a project message...') as HTMLTextAreaElement)
        .disabled,
    ).toBe(false)
  })

  it('preserves Project B draft and availability when a stale Project A POST succeeds', async () => {
    let resolvePost: (
      value: ApiSuccess<DiscussionMessage>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )
      .mockResolvedValueOnce(success([]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A draft',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(3)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    const input = screen.getByPlaceholderText(
      'Write a project message...',
    ) as HTMLTextAreaElement
    fireEvent.change(input, {
      target: {
        value: 'Project B draft',
      },
    })

    await act(async () => {
      resolvePost({
        success: true,
        data: message({
          id: 'stale-project-a-post',
          content: 'Stale Project A POST result',
        }),
        meta: success([]).meta,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(input.value).toBe('Project B draft')
    expect(
      document.querySelector('.message-list')?.textContent ?? '',
    ).not.toContain('Stale Project A POST result')
    expect(screen.queryByText('Project A POST failed')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('does not leak a stale POST failure after returning from Project B to Project A', async () => {
    let rejectPost: (reason?: unknown) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectPost = reject
        }),
      )
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(success([]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A original post',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(3)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-a"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(4)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    const input = screen.getByPlaceholderText(
      'Write a project message...',
    ) as HTMLTextAreaElement
    fireEvent.change(input, {
      target: {
        value: 'Current Project A draft',
      },
    })

    await act(async () => {
      rejectPost(new Error('Stale Project A POST failed'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('Stale Project A POST failed')).toBeNull()
    expect(input.value).toBe('Current Project A draft')
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('does not append or clear state for a stale POST after returning to Project A', async () => {
    let resolvePost: (
      value: ApiSuccess<DiscussionMessage>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(success([]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A original post',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(3)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-a"
      />,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(4)
    })
    await screen.findByText('No persisted Discussion messages yet.')

    const input = screen.getByPlaceholderText(
      'Write a project message...',
    ) as HTMLTextAreaElement
    fireEvent.change(input, {
      target: {
        value: 'Current Project A draft',
      },
    })

    await act(async () => {
      resolvePost({
        success: true,
        data: message({
          id: 'stale-project-a-post-after-return',
          content: 'Stale Project A POST result after return',
        }),
        meta: success([]).meta,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(input.value).toBe('Current Project A draft')
    expect(
      document.querySelector('.message-list')?.textContent ?? '',
    ).not.toContain('Stale Project A POST result after return')
    expect(screen.queryByText('Stale Project A POST failed')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('starts each returned project visit with clean composer state', async () => {
    const returnedProjectASnapshots: Array<{
      body: string
      content: string
    }> = []
    function RenderProbe({ projectId }: { projectId: string }) {
      const seenProjectA = useRef(false)

      useLayoutEffect(() => {
        if (projectId === 'project-a' && seenProjectA.current) {
          returnedProjectASnapshots.push({
            body: document.body.textContent ?? '',
            content: (
              document.querySelector(
                'textarea[placeholder="Write a project message..."]',
              ) as HTMLTextAreaElement
            ).value,
          })
        }

        if (projectId === 'project-a') {
          seenProjectA.current = true
        }
      }, [projectId])

      return (
        <DiscussionPanel
          currentUserId={currentUserId}
          projectId={projectId}
        />
      )
    }

    let resolveProjectAReturn: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProjectAReturn = resolve
        }),
      )

    const { rerender } = render(
      <RenderProbe projectId="project-a" />,
    )
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Old Project A draft',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    rerender(
      <RenderProbe projectId="project-b" />,
    )
    await screen.findByText('No persisted Discussion messages yet.')

    rerender(
      <RenderProbe projectId="project-a" />,
    )

    expect(returnedProjectASnapshots).toHaveLength(1)
    expect(returnedProjectASnapshots[0].content).toBe('')
    expect(returnedProjectASnapshots[0].body).toContain(
      'Loading Discussion messages...',
    )
    expect(returnedProjectASnapshots[0].body).not.toContain(
      'Old Project A draft',
    )

    await act(async () => {
      resolveProjectAReturn(success([]))
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.change(
      screen.getByPlaceholderText('Write a project message...'),
      {
        target: {
          value: 'Current Project A draft',
        },
      },
    )

    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('keeps a same-visit POST valid when a Project B render is abandoned', async () => {
    let resolvePost: (
      value: ApiSuccess<DiscussionMessage>,
    ) => void = () => undefined
    let projectBAttempted = false
    let projectBCommitted = false
    let switchToProjectB = () => undefined
    const projectBGate = new Promise<void>(() => undefined)

    function SuspendsProjectB({ projectId }: { projectId: string }) {
      useLayoutEffect(() => {
        if (projectId === 'project-b') {
          projectBCommitted = true
        }
      }, [projectId])

      if (projectId === 'project-b') {
        projectBAttempted = true
        throw projectBGate
      }

      return null
    }

    function ConcurrentHarness() {
      const [projectId, setProjectId] = useState('project-a')

      switchToProjectB = () => {
        startTransition(() => {
          setProjectId('project-b')
        })
      }

      return (
        <Suspense fallback={<div>Project B transition pending</div>}>
          <DiscussionPanel
            currentUserId={currentUserId}
            projectId={projectId}
          />
          <SuspendsProjectB projectId={projectId} />
        </Suspense>
      )
    }

    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        success([
          message({
            content: 'Project A committed message',
          }),
        ]),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )

    render(<ConcurrentHarness />)
    await screen.findByText('Project A committed message')

    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(
      'Write a project message...',
    ) as HTMLTextAreaElement
    await user.type(input, 'Project A draft')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    switchToProjectB()

    await waitFor(() => {
      expect(projectBAttempted).toBe(true)
    })
    expect(projectBCommitted).toBe(false)
    expect(screen.getByText('Project A committed message')).toBeTruthy()
    expect(screen.queryByText('Project B transition pending')).toBeNull()

    await act(async () => {
      resolvePost({
        success: true,
        data: message({
          id: 'same-visit-post-after-abandoned-render',
          content: 'Same-visit POST committed message',
        }),
        meta: success([]).meta,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      document.querySelector('.message-list')?.textContent ?? '',
    ).toContain('Same-visit POST committed message')
    expect(input.value).toBe('')
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
    expect(projectBCommitted).toBe(false)
  })

  it('synchronously isolates Project A composer state on the first Project B render', async () => {
    const snapshots: Array<{
      body: string
      content: string
    }> = []
    function RenderProbe({ projectId }: { projectId: string }) {
      useLayoutEffect(() => {
        if (projectId === 'project-b') {
          snapshots.push({
            body: document.body.textContent ?? '',
            content: (
              document.querySelector(
                'textarea[placeholder="Write a project message..."]',
              ) as HTMLTextAreaElement
            ).value,
          })
        }
      }, [projectId])

      return (
        <DiscussionPanel
          currentUserId={currentUserId}
          projectId={projectId}
        />
      )
    }

    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockRejectedValueOnce(new Error('Project A POST failed'))

    const { rerender } = render(
      <RenderProbe projectId="project-a" />,
    )
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Project A draft',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByText('Project A POST failed')

    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise(() => undefined),
    )
    rerender(
      <RenderProbe projectId="project-b" />,
    )

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].content).toBe('')
    expect(snapshots[0].body).not.toContain('Project A POST failed')
    expect(snapshots[0].body).toContain('Loading Discussion messages...')
  })

  it('does not expose Project A content during the first Project B render', async () => {
    const snapshots: string[] = []
    function RenderProbe({ projectId }: { projectId: string }) {
      useLayoutEffect(() => {
        if (projectId === 'project-b') {
          snapshots.push(document.body.textContent ?? '')
        }
      }, [projectId])

      return (
        <DiscussionPanel
          currentUserId={currentUserId}
          projectId={projectId}
        />
      )
    }

    vi.mocked(apiFetch).mockResolvedValueOnce(
      success([
        message({
          content: 'Project A content',
        }),
      ]),
    )

    const { rerender } = render(
      <RenderProbe projectId="project-a" />,
    )
    await screen.findByText('Project A content')

    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise(() => undefined),
    )
    rerender(
      <RenderProbe projectId="project-b" />,
    )

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).not.toContain('Project A content')
    expect(snapshots[0]).toContain('Loading Discussion messages...')
  })

  it('does not expose Project A read error during the first Project B render', async () => {
    const snapshots: string[] = []
    function RenderProbe({ projectId }: { projectId: string }) {
      useLayoutEffect(() => {
        if (projectId === 'project-b') {
          snapshots.push(document.body.textContent ?? '')
        }
      }, [projectId])

      return (
        <DiscussionPanel
          currentUserId={currentUserId}
          projectId={projectId}
        />
      )
    }

    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('Project A read failed'),
    )

    const { rerender } = render(
      <RenderProbe projectId="project-a" />,
    )
    await screen.findByText(
      'Unable to load persisted Discussion messages: Project A read failed',
    )

    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise(() => undefined),
    )
    rerender(
      <RenderProbe projectId="project-b" />,
    )

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).not.toContain('Project A read failed')
    expect(snapshots[0]).toContain('Loading Discussion messages...')
  })

  it('disables posting after the initial Discussion read fails', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('Read failed'),
    )

    renderPanel()
    await screen.findByText(
      'Unable to load persisted Discussion messages: Read failed',
    )

    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(
      'Write a project message...',
    ) as HTMLTextAreaElement
    const send = screen.getByRole('button', {
      name: 'Send',
    }) as HTMLButtonElement
    await user.type(input, 'Blocked while read failed')
    await user.click(send)

    expect(input.disabled).toBe(true)
    expect(send.disabled).toBe(true)
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('requests messages again when projectId changes', async () => {
    const { rerender } = renderPanel('project-a')
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/projects/project-a/messages',
      )
    })

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/projects/project-b/messages',
      )
    })
  })

  it('clears the previous project messages while the new project loads', async () => {
    let resolveProjectB: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        success([
          message({
            content: 'Project A message',
          }),
        ]),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProjectB = resolve
        }),
      )

    const { rerender } = renderPanel('project-a')
    expect(await screen.findByText('Project A message')).toBeTruthy()

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )

    expect(screen.queryByText('Project A message')).toBeNull()
    expect(
      screen.getByText('Loading Discussion messages...'),
    ).toBeTruthy()

    resolveProjectB(success([]))
  })

  it('ignores stale completion from a previous project', async () => {
    let resolveProjectA: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    let resolveProjectB: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProjectA = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProjectB = resolve
        }),
      )

    const { rerender } = renderPanel('project-a')
    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )

    resolveProjectA(
      success([
        message({
          content: 'Stale Project A message',
        }),
      ]),
    )
    await waitFor(() => {
      expect(
        screen.queryByText('Stale Project A message'),
      ).toBeNull()
    })

    resolveProjectB(
      success([
        message({
          project_id: 'project-b',
          content: 'Current Project B message',
        }),
      ]),
    )
    expect(
      await screen.findByText('Current Project B message'),
    ).toBeTruthy()
  })

  it('does not update Discussion after its initial read effect unmounts', async () => {
    let resolveRead: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    )

    const { unmount } = renderPanel()
    unmount()

    resolveRead(
      success([
        message({
          content: 'Unmounted message',
        }),
      ]),
    )

    await Promise.resolve()
    expect(screen.queryByText('Unmounted message')).toBeNull()
  })

  it('uses apiFetch as the browser data boundary for message reads', async () => {
    renderPanel('project-a')

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1)
    })

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/projects/project-a/messages',
    )
  })
})


describe('VS003 Stage 5 manual Discussion convergence', () => {
  it('exposes Refresh after a successful initial load', async () => {
    renderPanel()

    expect(
      await screen.findByRole('button', { name: 'Refresh' }),
    ).toBeTruthy()
  })

  it('issues a fresh GET for the exact current project when Refresh is clicked', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(success([]))

    renderPanel('project-a')
    await screen.findByText('No persisted Discussion messages yet.')

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2)
    })
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/projects/project-a/messages',
    )
  })

  it('keeps existing messages visible and shows refresh progress while Refresh is pending', async () => {
    let resolveRefresh: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Existing message' }),
      ]))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveRefresh = resolve
      }))

    renderPanel()
    await screen.findByText('Existing message')

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    expect(screen.getByText('Existing message')).toBeTruthy()
    expect(screen.getByText('Refreshing discussion…')).toBeTruthy()

    resolveRefresh(success([
      message({ content: 'Refreshed message' }),
    ]))
    expect(await screen.findByText('Refreshed message')).toBeTruthy()
    expect(screen.queryByText('Existing message')).toBeNull()
  })

  it('cannot trigger another Refresh while the current refresh is pending', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(new Promise(() => undefined))

    renderPanel()
    await screen.findByText('No persisted Discussion messages yet.')

    const user = userEvent.setup()
    const refresh = screen.getByRole('button', {
      name: 'Refresh',
    }) as HTMLButtonElement
    await user.click(refresh)
    expect(refresh.disabled).toBe(true)

    await user.click(refresh)
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('replaces the current list with a successful Refresh in API order', async () => {
    const first = message({
      id: 'message-first',
      content: 'First refreshed message',
    })
    const second = message({
      id: 'message-second',
      content: 'Second refreshed message',
    })
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Old message' }),
      ]))
      .mockResolvedValueOnce(success([second, first]))

    renderPanel()
    await screen.findByText('Old message')
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    const firstMessage = await screen.findByText(
      'Second refreshed message',
    )
    const secondMessage = screen.getByText(
      'First refreshed message',
    )
    expect(screen.queryByText('Old message')).toBeNull()
    expect(
      firstMessage.compareDocumentPosition(secondMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows an external committed message only after manual Refresh', async () => {
    const participantMessage = message({
      id: 'participant-message',
      author_user_id: 'participant-456789',
      content: 'Message committed by another participant',
    })
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Message A' }),
      ]))
      .mockResolvedValueOnce(success([
        message({ content: 'Message A' }),
        participantMessage,
      ]))

    renderPanel()
    await screen.findByText('Message A')
    expect(
      screen.queryByText('Message committed by another participant'),
    ).toBeNull()

    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    expect(
      await screen.findByText('Message committed by another participant'),
    ).toBeTruthy()
  })

  it('keeps valid messages visible and reports a non-blocking Refresh failure', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Still visible after failure' }),
      ]))
      .mockRejectedValueOnce(new Error('Refresh unavailable'))

    renderPanel()
    await screen.findByText('Still visible after failure')
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    expect(
      await screen.findByText('Could not refresh discussion.'),
    ).toBeTruthy()
    expect(screen.getByText('Still visible after failure')).toBeTruthy()
    expect(
      screen.queryByText(/Unable to load persisted Discussion messages/i),
    ).toBeNull()
  })

  it('allows a later Refresh to recover from a Refresh failure', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Before recovery' }),
      ]))
      .mockRejectedValueOnce(new Error('Temporary refresh failure'))
      .mockResolvedValueOnce(success([
        message({ content: 'After recovery' }),
      ]))

    renderPanel()
    await screen.findByText('Before recovery')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Could not refresh discussion.')

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('After recovery')).toBeTruthy()
    expect(screen.queryByText('Could not refresh discussion.')).toBeNull()
  })

  it('exposes blocking Retry and keeps posting disabled after an initial read failure', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('Initial read failed'),
    )

    renderPanel()
    await screen.findByText(
      'Unable to load persisted Discussion messages: Initial read failed',
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(
      (screen.getByPlaceholderText('Write a project message...') as HTMLTextAreaElement)
        .disabled,
    ).toBe(true)
  })

  it('issues a fresh GET and shows retry progress without duplicate Retry requests', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new Error('Initial read failed'))
      .mockReturnValueOnce(new Promise(() => undefined))

    renderPanel()
    await screen.findByText(
      'Unable to load persisted Discussion messages: Initial read failed',
    )

    const user = userEvent.setup()
    const retry = screen.getByRole('button', {
      name: 'Retry',
    }) as HTMLButtonElement
    await user.click(retry)

    expect(screen.getByText('Retrying discussion…')).toBeTruthy()
    expect(retry.disabled).toBe(true)
    await user.click(retry)
    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/projects/project-a/messages',
    )
  })

  it('exits the blocking error state and renders messages after successful Retry', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new Error('Initial read failed'))
      .mockResolvedValueOnce(success([
        message({ content: 'Recovered persisted message' }),
      ]))

    renderPanel()
    await screen.findByText(
      'Unable to load persisted Discussion messages: Initial read failed',
    )
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Retry' }),
    )

    expect(await screen.findByText('Recovered persisted message')).toBeTruthy()
    expect(
      screen.queryByText(/Unable to load persisted Discussion messages/i),
    ).toBeNull()
    expect(
      (screen.getByPlaceholderText('Write a project message...') as HTMLTextAreaElement)
        .disabled,
    ).toBe(false)
  })

  it('keeps failed Retry recoverable in the blocking error state', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new Error('Initial read failed'))
      .mockRejectedValueOnce(new Error('Retry failed'))

    renderPanel()
    await screen.findByText(
      'Unable to load persisted Discussion messages: Initial read failed',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByText(
        'Unable to load persisted Discussion messages: Retry failed',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText('No persisted Discussion messages yet.')).toBeNull()
  })

  it('disables posting while manual Refresh is pending', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(new Promise(() => undefined))

    renderPanel()
    await screen.findByText('No persisted Discussion messages yet.')
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    expect(
      (screen.getByPlaceholderText('Write a project message...') as HTMLTextAreaElement)
        .disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('disables Refresh while POST is sending', async () => {
    let resolvePost: (
      value: ApiSuccess<DiscussionMessage>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([]))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolvePost = resolve
      }))

    renderPanel()
    await screen.findByText('No persisted Discussion messages yet.')
    const user = userEvent.setup()
    await user.type(
      screen.getByPlaceholderText('Write a project message...'),
      'Message while refresh is blocked',
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      (screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(apiFetch).toHaveBeenCalledTimes(2)

    resolvePost({
      success: true,
      data: message({ content: 'Message while refresh is blocked' }),
      meta: success([]).meta,
    })
    expect(
      await screen.findByText('Message while refresh is blocked'),
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('rejects a stale Refresh completion after switching from Project A to Project B', async () => {
    let resolveProjectARefresh: (
      value: ApiSuccess<{ messages: DiscussionMessage[] }>,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Project A message' }),
      ]))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveProjectARefresh = resolve
      }))
      .mockResolvedValueOnce(success([
        message({
          project_id: 'project-b',
          content: 'Project B message',
        }),
      ]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('Project A message')
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await screen.findByText('Project B message')

    resolveProjectARefresh(success([
      message({ content: 'Stale Project A refresh result' }),
    ]))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('Stale Project A refresh result')).toBeNull()
    expect(screen.queryByText('Could not refresh discussion.')).toBeNull()
    expect(screen.getByText('Project B message')).toBeTruthy()
  })

  it('rejects a stale Refresh failure and finally after switching from Project A to Project B', async () => {
    let rejectProjectARefresh: (
      reason?: unknown,
    ) => void = () => undefined
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Project A message' }),
      ]))
      .mockReturnValueOnce(new Promise((_, reject) => {
        rejectProjectARefresh = reject
      }))
      .mockResolvedValueOnce(success([
        message({
          project_id: 'project-b',
          content: 'Project B message',
        }),
      ]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('Project A message')
    await userEvent.setup().click(
      screen.getByRole('button', { name: 'Refresh' }),
    )

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await screen.findByText('Project B message')

    rejectProjectARefresh(new Error('Stale Project A refresh failure'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Project B message')).toBeTruthy()
    expect(screen.queryByText('Stale Project A refresh failure')).toBeNull()
    expect(screen.queryByText('Could not refresh discussion.')).toBeNull()
    expect(screen.queryByText('Refreshing discussion…')).toBeNull()
  })

  it('issues a new GET and reconstructs persisted messages after unmount and remount', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Before remount' }),
      ]))
      .mockResolvedValueOnce(success([
        message({ content: 'After remount' }),
      ]))

    const first = renderPanel()
    await screen.findByText('Before remount')
    first.unmount()

    renderPanel()
    expect(await screen.findByText('After remount')).toBeTruthy()
    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/projects/project-a/messages',
    )
  })

  it('uses a fresh GET when leaving and returning to the same project', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(success([
        message({ content: 'Initial Project A message' }),
      ]))
      .mockResolvedValueOnce(success([
        message({
          project_id: 'project-b',
          content: 'Project B message',
        }),
      ]))
      .mockResolvedValueOnce(success([
        message({ content: 'Current Project A message' }),
      ]))

    const { rerender } = renderPanel('project-a')
    await screen.findByText('Initial Project A message')

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-b"
      />,
    )
    await screen.findByText('Project B message')

    rerender(
      <DiscussionPanel
        currentUserId={currentUserId}
        projectId="project-a"
      />,
    )
    expect(await screen.findByText('Current Project A message')).toBeTruthy()
    expect(screen.queryByText('Initial Project A message')).toBeNull()
    expect(apiFetch).toHaveBeenCalledTimes(3)
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/projects/project-a/messages',
    )
  })

  it('does not issue an automatic additional GET while Discussion is idle', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(success([
      message({ content: 'Idle persisted message' }),
    ]))

    renderPanel()
    await screen.findByText('Idle persisted message')
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
