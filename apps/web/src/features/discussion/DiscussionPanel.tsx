import {
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


interface DiscussionPanelProps {
  projectId: string
}


export function DiscussionPanel({
  projectId,
}: DiscussionPanelProps) {
  const [
    content,
    setContent,
  ] =
    useState('')

  const [
    messages,
    setMessages,
  ] =
    useState<DiscussionMessage[]>([])

  const [
    sending,
    setSending,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)


  const trimmedContent =
    content.trim()

  const canSend =
    trimmedContent.length > 0 &&
    trimmedContent.length <= 20000 &&
    !sending


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    if (!canSend) {
      return
    }


    setSending(true)
    setError(null)


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


      setMessages(
        (current) => [
          ...current,
          response.data,
        ],
      )

      setContent('')
    } catch (
      postError: unknown
    ) {
      setError(
        postError instanceof Error
          ? postError.message
          : 'Unable to post the message.',
      )
    } finally {
      setSending(false)
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
        {messages.length === 0 ? (
          <div className="discussion-empty">
            <strong>
              Start the discussion.
            </strong>

            <p>
              Messages posted in this browser
              session will appear here.
            </p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map(
              (message) => (
                <article
                  className="discussion-message"
                  key={message.id}
                >
                  <div className="message-meta">
                    <strong>
                      You
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
            value={content}
            disabled={sending}
            onChange={
              (event) => {
                setContent(
                  event.target.value,
                )
              }
            }
          />

          <div className="composer-meta">
            <span>
              {content.length.toLocaleString()}
              /20,000
            </span>

            {error && (
              <span
                className="composer-error"
                role="alert"
              >
                {error}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSend}
        >
          {sending
            ? 'Sending...'
            : 'Send'}
        </button>
      </form>
    </article>
  )
}