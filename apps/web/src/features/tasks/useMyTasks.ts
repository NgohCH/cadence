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
  MyTask,
  MyTasksResponse,
} from '../../types/tasks'


export function useMyTasks() {
  const [
    tasks,
    setTasks,
  ] =
    useState<MyTask[]>([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )


  const loadTasks =
    useCallback(
      async (): Promise<void> => {
        setLoading(
          true,
        )

        setError(
          null,
        )


        try {
          const response =
            await apiFetch<
              ApiSuccess<MyTasksResponse>
            >(
              '/api/v1/me/tasks',
            )


          setTasks(
            response.data.tasks,
          )
        } catch (
          loadError:
            unknown
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load your Tasks.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )


  useEffect(
    () => {
      void loadTasks()
    },
    [
      loadTasks,
    ],
  )


  return {
    tasks,
    loading,
    error,

    refresh:
      loadTasks,
  }
}