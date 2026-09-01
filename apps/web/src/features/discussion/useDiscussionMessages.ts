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
  refreshing: boolean
  error: string | null
  refreshError: string | null
}

type ReadMode =
  | 'initial'
  | 'refresh'


function errorMessage(
  loadError: unknown,
  fallback: string,
): string {
  return loadError instanceof Error
    ? loadError.message
    : fallback
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
      refreshing: false,
      error: null,
      refreshError: null,
    })

  const projectIdRef =
    useRef(projectId)

  const visitGenerationRef =
    useRef(0)
  const readRequestGenerationRef =
    useRef(0)
  const readPendingRef =
    useRef(false)

  useLayoutEffect(
    () => {
      if (
        projectIdRef.current !==
        projectId
      ) {
        projectIdRef.current = projectId
        visitGenerationRef.current += 1
        readRequestGenerationRef.current = 0
        readPendingRef.current = false
      }
    },
    [projectId],
  )

  const mountedRef =
    useRef(false)

  const startRead =
    useCallback(
      (mode: ReadMode) => {
        if (
          !mountedRef.current ||
          projectIdRef.current !==
            projectId ||
          readPendingRef.current
        ) {
          return
        }

        const visitGeneration =
          visitGenerationRef.current
        const requestGeneration =
          readRequestGenerationRef.current +
          1

        readRequestGenerationRef.current =
          requestGeneration
        readPendingRef.current = true

        if (mode === 'initial') {
          setSnapshot(
            (current) => ({
              projectId,
              messages: [],
              loading: true,
              refreshing: false,
              error:
                current.projectId ===
                projectId
                  ? current.error
                  : null,
              refreshError: null,
            }),
          )
        } else {
          setSnapshot(
            (current) => {
              if (
                current.projectId !==
                  projectId ||
                current.loading ||
                current.error ||
                current.refreshing
              ) {
                return current
              }

              return {
                ...current,
                refreshing: true,
                refreshError: null,
              }
            },
          )
        }

        const isCurrentRead =
          () =>
            mountedRef.current &&
            projectIdRef.current ===
              projectId &&
            visitGenerationRef.current ===
              visitGeneration &&
            readRequestGenerationRef.current ===
              requestGeneration

        void apiFetch<
          ApiSuccess<DiscussionMessagesResponse>
        >(
          `/api/v1/projects/${encodeURIComponent(projectId)}/messages`,
        )
          .then(
            (response) => {
              if (!isCurrentRead()) {
                return
              }

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
                    messages:
                      response.data.messages,
                    loading: false,
                    refreshing: false,
                    error: null,
                    refreshError: null,
                  }
                },
              )
            },
          )
          .catch(
            (loadError: unknown) => {
              if (!isCurrentRead()) {
                return
              }

              setSnapshot(
                (current) => {
                  if (
                    current.projectId !==
                    projectId
                  ) {
                    return current
                  }

                  if (mode === 'refresh') {
                    return {
                      ...current,
                      loading: false,
                      refreshing: false,
                      refreshError:
                        errorMessage(
                          loadError,
                          'Unable to refresh Discussion messages.',
                        ),
                    }
                  }

                  return {
                    ...current,
                    messages: [],
                    loading: false,
                    refreshing: false,
                    error:
                      errorMessage(
                        loadError,
                        'Unable to load Discussion messages.',
                      ),
                    refreshError: null,
                  }
                },
              )
            },
          )
          .finally(
            () => {
              if (!isCurrentRead()) {
                return
              }

              readPendingRef.current = false

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
                    loading:
                      mode === 'initial'
                        ? false
                        : current.loading,
                    refreshing:
                      mode === 'refresh'
                        ? false
                        : current.refreshing,
                  }
                },
              )
            },
          )
      },
      [
        projectId,
      ],
    )


  useEffect(
    () => {
      mountedRef.current = true
      startRead('initial')

      return () => {
        if (
          projectIdRef.current ===
          projectId
        ) {
          mountedRef.current = false
          readPendingRef.current = false
        }
      }
    },
    [
      projectId,
      startRead,
    ],
  )


  const refresh =
    useCallback(
      () => {
        startRead('refresh')
      },
      [
        startRead,
      ],
    )


  const retry =
    useCallback(
      () => {
        startRead('initial')
      },
      [
        startRead,
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
          refreshing: false,
          error: null,
          refreshError: null,
        }


  return {
    messages:
      currentSnapshot.messages,
    loading:
      currentSnapshot.loading,
    refreshing:
      currentSnapshot.refreshing,
    error:
      currentSnapshot.error,
    refreshError:
      currentSnapshot.refreshError,
    refresh,
    retry,
    appendMessage,
  }
}
