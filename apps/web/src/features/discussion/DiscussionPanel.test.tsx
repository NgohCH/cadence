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
