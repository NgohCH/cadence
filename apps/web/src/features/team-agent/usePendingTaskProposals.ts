import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  apiFetch,
} from '../../lib/api'

import type {
  ApiSuccess,
} from '../../types/api'

import type {
  PendingTaskProposal,
  PendingTaskProposalsResponse,
} from '../../types/teamAgent'


export function usePendingTaskProposals(
  projectId: string,
) {
  const [
    proposals,
    setProposals,
  ] =
    useState<PendingTaskProposal[]>([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0)


  useEffect(
    () => {
      let active = true

      setLoading(true)
      setError(null)

      void apiFetch<
        ApiSuccess<PendingTaskProposalsResponse>
      >(
        `/api/v1/projects/${projectId}/task-proposals`,
      )
        .then(
          (response) => {
            if (active) {
              setProposals(
                response.data.proposals,
              )
            }
          },
        )
        .catch(
          (proposalError: unknown) => {
            if (!active) {
              return
            }

            setError(
              proposalError instanceof Error
                ? proposalError.message
                : 'Unable to load Team Agent proposals.',
            )
          },
        )
        .finally(
          () => {
            if (active) {
              setLoading(false)
            }
          },
        )

      return () => {
        active = false
      }
    },
    [
      projectId,
      refreshVersion,
    ],
  )


  const refresh =
    useCallback(
      () => {
        setRefreshVersion(
          (current) => current + 1,
        )
      },
      [],
    )


  return {
    proposals,
    loading,
    error,
    refresh,
  }
}