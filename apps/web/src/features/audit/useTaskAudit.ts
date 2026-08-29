import {
  useCallback,
  useEffect,
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
  TaskAuditJourney,
  TaskAuditResponse,
} from '../../types/audit'


export function useTaskAudit(
  projectId: string | null,
  taskId: string | null,
) {
  const [
    journey,
    setJourney,
  ] =
    useState<TaskAuditJourney | null>(
      null,
    )

  const [
    requestCorrelationId,
    setRequestCorrelationId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const requestSequence =
    useRef(0)


  const loadAudit =
    useCallback(
      async (): Promise<void> => {
        const sequence =
          ++requestSequence.current


        if (
          !projectId ||
          !taskId
        ) {
          setJourney(
            null,
          )

          setRequestCorrelationId(
            null,
          )

          setError(
            null,
          )

          setLoading(
            false,
          )

          return
        }


        setLoading(
          true,
        )

        setError(
          null,
        )


        try {
          const response =
            await apiFetch<
              ApiSuccess<TaskAuditResponse>
            >(
              `/api/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/audit`,
            )


          if (
            sequence !==
            requestSequence.current
          ) {
            return
          }


          setJourney(
            response.data.journey,
          )

          setRequestCorrelationId(
            response.meta.correlation_id,
          )
        } catch (
          loadError:
            unknown
        ) {
          if (
            sequence !==
            requestSequence.current
          ) {
            return
          }


          setJourney(
            null,
          )

          setRequestCorrelationId(
            null,
          )

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load the Task audit journey.',
          )
        } finally {
          if (
            sequence ===
            requestSequence.current
          ) {
            setLoading(
              false,
            )
          }
        }
      },
      [
        projectId,
        taskId,
      ],
    )


  useEffect(
    () => {
      void loadAudit()


      return () => {
        requestSequence.current +=
          1
      }
    },
    [
      loadAudit,
    ],
  )


  return {
    journey,
    requestCorrelationId,
    loading,
    error,

    refresh:
      loadAudit,
  }
}