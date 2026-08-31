import {
  useCallback,
  useEffect,
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


interface DiscussionMessagesResponse {
  messages: DiscussionMessage[]
}

interface DiscussionSnapshot {
  projectId: string
  messages: DiscussionMessage[]
  loading: boolean
  error: string | null
}


export function useDiscussionMessages(
  projectId: string,
) {
  const [
    snapshot,
    setSnapshot,
  ] =
    useState<DiscussionSnapshot>({
      projectId,
      messages: [],
      loading: true,
      error: null,
    })

  const projectIdRef =
    useRef(projectId)

  useLayoutEffect(
    () => {
      projectIdRef.current = projectId
    },
    [projectId],
  )

  const mountedRef =
    useRef(false)


  useEffect(
    () => {
      let active = true

      mountedRef.current = true
      setSnapshot({
        projectId,
        messages: [],
        loading: true,
        error: null,
      })

      void apiFetch<
        ApiSuccess<DiscussionMessagesResponse>
      >(
        `/api/v1/projects/${encodeURIComponent(projectId)}/messages`,
      )
        .then(
          (response) => {
            if (active) {
              setSnapshot(
                (current) => {
                  if (
                    current.projectId !==
                    projectId
                  ) {
                    return current
                  }

                  return {
                    projectId,
                    messages:
                      response.data.messages,
                    loading: false,
                    error: null,
                  }
                },
              )
            }
          },
        )
        .catch(
          (loadError: unknown) => {
            if (active) {
              setSnapshot(
                (current) => {
                  if (
                    current.projectId !==
                    projectId
                  ) {
                    return current
                  }

                  return {
                    projectId,
                    messages: [],
                    loading: false,
                    error:
                      loadError instanceof Error
                        ? loadError.message
                        : 'Unable to load Discussion messages.',
                  }
                },
              )
            }
          },
        )
        .finally(
          () => {
            if (active) {
              setSnapshot(
                (current) => {
                  if (
                    current.projectId !==
                    projectId
                  ) {
                    return current
                  }

                  return {
                    ...current,
                    loading: false,
                  }
                },
              )
            }
          },
        )

      return () => {
        active = false

        if (
          projectIdRef.current ===
          projectId
        ) {
          mountedRef.current = false
        }
      }
    },
    [
      projectId,
    ],
  )


  const appendMessage =
    useCallback(
      (message: DiscussionMessage) => {
        if (
          !mountedRef.current ||
          projectIdRef.current !==
            projectId ||
          message.project_id !==
            projectId
        ) {
          return
        }

        setSnapshot(
          (current) => {
            if (
              current.projectId !==
                projectId ||
              current.loading ||
              current.error
            ) {
              return current
            }

            return {
              ...current,
              messages: [
                ...current.messages,
                message,
              ],
            }
          },
        )
      },
      [
        projectId,
      ],
    )


  const currentSnapshot =
    snapshot.projectId ===
    projectId
      ? snapshot
      : {
          projectId,
          messages: [],
          loading: true,
          error: null,
        }


  return {
    messages:
      currentSnapshot.messages,
    loading:
      currentSnapshot.loading,
    error:
      currentSnapshot.error,
    appendMessage,
  }
}
