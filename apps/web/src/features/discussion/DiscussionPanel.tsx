import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
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
  useDiscussionMessages,
} from './useDiscussionMessages'


interface DiscussionPanelProps {
  projectId: string
  currentUserId: string
}

interface ComposerSnapshot {
  projectId: string
  generation: number
  content: string
  postError: string | null
  sending: boolean
}


function authorLabel(
  message: DiscussionMessage,
  currentUserId: string,
): string {
  if (
    message.author_type ===
    'agent'
  ) {
    return 'Team Agent'
  }

  if (
    message.author_type ===
    'system'
  ) {
    return 'System'
  }

  if (
    message.author_user_id ===
    currentUserId
  ) {
    return 'You'
  }

  return `Participant ${message.author_user_id?.slice(0, 11) ?? 'unknown'}`
}


export function DiscussionPanel({
  projectId,
  currentUserId,
}: DiscussionPanelProps) {
  const committedProjectRef =
    useRef(projectId)
  const visitGenerationRef =
    useRef(0)
  const currentVisitGeneration =
    committedProjectRef.current ===
    projectId
      ? visitGenerationRef.current
      : visitGenerationRef.current + 1

  useLayoutEffect(
    () => {
      if (
        committedProjectRef.current !==
        projectId
      ) {
        committedProjectRef.current =
          projectId
        visitGenerationRef.current += 1
      }
    },
    [projectId],
  )

  const [
    composerSnapshot,
    setComposerSnapshot,
  ] =
    useState<ComposerSnapshot>({
      projectId,
      generation:
        currentVisitGeneration,
      content: '',
      postError: null,
      sending: false,
    })

  const mountedRef =
    useRef(false)

  useEffect(
    () => {
      mountedRef.current = true

      return () => {
        mountedRef.current = false
      }
    },
    [],
  )

  const discussion =
    useDiscussionMessages(
      projectId,
    )

  const currentComposer =
    composerSnapshot.projectId ===
      projectId &&
    composerSnapshot.generation ===
      currentVisitGeneration
      ? composerSnapshot
      : {
          projectId,
          generation:
            currentVisitGeneration,
          content: '',
          postError: null,
          sending: false,
        }


  const trimmedContent =
    currentComposer.content.trim()

  const canSend =
    trimmedContent.length > 0 &&
    trimmedContent.length <= 20000 &&
    !currentComposer.sending &&
    !discussion.loading &&
    !discussion.error


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    if (!canSend) {
      return
    }


    const initiatingProjectId =
      projectId
    const initiatingVisitGeneration =
      currentVisitGeneration

    if (
      !mountedRef.current ||
      committedProjectRef.current !==
        initiatingProjectId ||
      visitGenerationRef.current !==
        initiatingVisitGeneration
    ) {
      return
    }

    setComposerSnapshot(
      (current) => {
        if (
          current.projectId !==
            initiatingProjectId ||
          current.generation !==
            initiatingVisitGeneration
        ) {
          return current
        }

        return {
          ...current,
          sending: true,
          postError: null,
        }
      },
    )


    try {
      const response =
        await apiFetch<
          ApiSuccess<DiscussionMessage>
        >(
          `/api/v1/projects/${projectId}/messages`,
          {
            method: 'POST',

            body: JSON.stringify({
              content:
                trimmedContent,

              thread_parent_id:
                null,
            }),
          },
        )


      if (
        mountedRef.current &&
        committedProjectRef.current ===
          initiatingProjectId &&
        visitGenerationRef.current ===
          initiatingVisitGeneration
      ) {
        discussion.appendMessage(
          response.data,
        )

        setComposerSnapshot(
          (current) => {
            if (
              current.projectId !==
                initiatingProjectId ||
              current.generation !==
                initiatingVisitGeneration
            ) {
              return current
            }

            return {
              ...current,
              content: '',
            }
          },
        )
      }
    } catch (
      postError: unknown
    ) {
      if (
        mountedRef.current &&
        committedProjectRef.current ===
          initiatingProjectId &&
        visitGenerationRef.current ===
          initiatingVisitGeneration
      ) {
        setComposerSnapshot(
          (current) => {
            if (
              current.projectId !==
                initiatingProjectId ||
              current.generation !==
                initiatingVisitGeneration
            ) {
              return current
            }

            return {
              ...current,
              postError:
                postError instanceof Error
                  ? postError.message
                  : 'Unable to post the message.',
            }
          },
        )
      }
    } finally {
      if (
        mountedRef.current &&
        committedProjectRef.current ===
          initiatingProjectId &&
        visitGenerationRef.current ===
          initiatingVisitGeneration
      ) {
        setComposerSnapshot(
          (current) => {
            if (
              current.projectId !==
                initiatingProjectId ||
              current.generation !==
                initiatingVisitGeneration
            ) {
              return current
            }

            return {
              ...current,
              sending: false,
            }
          },
        )
      }
    }
  }


  return (
    <article className="panel discussion-panel">
      <header className="panel-header">
        <div>
          <h2>
            Discussion
          </h2>

          <p className="muted">
            Collaborate with your project team
            and Team Agent.
          </p>
        </div>
      </header>

      <div className="discussion-content">
        {discussion.loading ? (
          <div className="discussion-state">
            Loading Discussion messages...
          </div>
        ) : discussion.error ? (
          <div
            className="discussion-state discussion-read-error"
            role="alert"
          >
            Unable to load persisted Discussion messages:{' '}
            {discussion.error}
          </div>
        ) : discussion.messages.length === 0 ? (
          <div className="discussion-empty">
            <strong>
              No persisted Discussion messages yet.
            </strong>

            <p>
              Start a durable project conversation.
            </p>
          </div>
        ) : (
          <div className="message-list">
            {discussion.messages.map(
              (message) => (
                <article
                  className="discussion-message"
                  key={message.id}
                >
                  <div className="message-meta">
                    <strong
                      title={
                        message.author_user_id ??
                        undefined
                      }
                    >
                      {authorLabel(
                        message,
                        currentUserId,
                      )}
                    </strong>

                    <time
                      dateTime={
                        message.created_at
                      }
                    >
                      {new Date(
                        message.created_at,
                      ).toLocaleString()}
                    </time>
                  </div>

                  <p>
                    {message.content}
                  </p>
                </article>
              ),
            )}
          </div>
        )}
      </div>

      <form
        className="composer"
        onSubmit={
          (event) => {
            void handleSubmit(
              event,
            )
          }
        }
      >
        <div className="composer-input">
          <textarea
            rows={3}
            maxLength={20000}
            placeholder="Write a project message..."
            value={currentComposer.content}
            disabled={
              currentComposer.sending ||
              discussion.loading ||
              Boolean(discussion.error)
            }
            onChange={
              (event) => {
                const nextContent =
                  event.target.value

                setComposerSnapshot(
                  (current) => {
                    if (
                      current.projectId !==
                        projectId ||
                      current.generation !==
                        currentVisitGeneration
                    ) {
                      return {
                        projectId,
                        generation:
                          currentVisitGeneration,
                        content: nextContent,
                        postError: null,
                        sending: false,
                      }
                    }

                    return {
                      ...current,
                      content: nextContent,
                    }
                  },
                )
              }
            }
          />

          <div className="composer-meta">
            <span>
              {currentComposer.content.length.toLocaleString()}
              /20,000
            </span>

            {currentComposer.postError && (
              <span
                className="composer-error"
                role="alert"
              >
                {currentComposer.postError}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSend}
        >
          {currentComposer.sending
            ? 'Sending...'
            : 'Send'}
        </button>
      </form>
    </article>
  )
}
