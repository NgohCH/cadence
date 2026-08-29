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
  ProjectSummaryResponse,
} from '../../types/projects'


export function useProjectSummary(
  projectId: string,
) {
  const [
    summary,
    setSummary,
  ] =
    useState<ProjectSummaryResponse | null>(
      null,
    )

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
        ApiSuccess<ProjectSummaryResponse>
      >(
        `/api/v1/projects/${projectId}/summary`,
      )
        .then(
          (response) => {
            if (active) {
              setSummary(response.data)
            }
          },
        )
        .catch(
          (projectError: unknown) => {
            if (!active) {
              return
            }

            setSummary(null)

            setError(
              projectError instanceof Error
                ? projectError.message
                : 'Unable to load the project workspace.',
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
    summary,
    loading,
    error,
    refresh,
  }
}