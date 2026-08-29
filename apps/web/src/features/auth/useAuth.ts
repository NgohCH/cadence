import {
  useEffect,
  useState,
} from 'react'

import type {
  Session,
} from '@supabase/supabase-js'

import {
  apiFetch,
} from '../../lib/api'

import {
  getSupabaseBrowserClient,
} from '../../lib/supabase'

import type {
  ApiSuccess,
} from '../../types/api'

import type {
  CadenceUser,
} from '../../types/identity'


export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'error'


export interface AuthState {
  status: AuthStatus
  user: CadenceUser | null
  error: string | null
  hasSession: boolean
  signingIn: boolean
  signingOut: boolean
  signIn: (
    email: string,
    password: string,
  ) => Promise<void>
  signOut: () => Promise<void>
  retryIdentity: () => void
}


export function useAuth(): AuthState {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null,
    )

  const [
    sessionResolved,
    setSessionResolved,
  ] =
    useState(
      false,
    )

  const [
    user,
    setUser,
  ] =
    useState<CadenceUser | null>(
      null,
    )

  const [
    status,
    setStatus,
  ] =
    useState<AuthStatus>(
      'loading',
    )

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const [
    signingIn,
    setSigningIn,
  ] =
    useState(
      false,
    )

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(
      false,
    )

  const [
    identityAttempt,
    setIdentityAttempt,
  ] =
    useState(
      0,
    )


  /*
   * Restore the Supabase browser session and then
   * keep local state synchronized with auth events.
   */

  useEffect(
    () => {
      let active =
        true

      const supabase =
        getSupabaseBrowserClient()


      void supabase.auth
        .getSession()
        .then(
          ({
            data,
            error:
              sessionError,
          }) => {
            if (!active) {
              return
            }

            if (sessionError) {
              setError(
                sessionError.message,
              )

              setSession(
                null,
              )

              setSessionResolved(
                true,
              )

              setStatus(
                'anonymous',
              )

              return
            }

            setSession(
              data.session,
            )

            setSessionResolved(
              true,
            )
          },
        )


      const {
        data: {
          subscription,
        },
      } =
        supabase.auth
          .onAuthStateChange(
            (
              _event,
              nextSession,
            ) => {
              if (!active) {
                return
              }

              setSession(
                nextSession,
              )

              setSessionResolved(
                true,
              )
            },
          )


      return () => {
        active =
          false

        subscription
          .unsubscribe()
      }
    },
    [],
  )


  /*
   * A Supabase session is not enough to grant
   * access to Cadence.
   *
   * Validate the authenticated identity through
   * the Cadence API.
   */

  useEffect(
    () => {
      if (
        !sessionResolved
      ) {
        return
      }


      if (!session) {
        setUser(
          null,
        )

        setStatus(
          'anonymous',
        )

        return
      }


      let active =
        true


      setStatus(
        'loading',
      )

      setError(
        null,
      )


      void apiFetch<
        ApiSuccess<CadenceUser>
      >(
        '/api/v1/me',
      )
        .then(
          (response) => {
            if (!active) {
              return
            }

            setUser(
              response.data,
            )

            setStatus(
              'authenticated',
            )
          },
        )
        .catch(
          (
            identityError:
              unknown,
          ) => {
            if (!active) {
              return
            }

            setUser(
              null,
            )

            setStatus(
              'error',
            )

            setError(
              identityError
                instanceof Error
                ? identityError.message
                : 'Unable to validate the Cadence identity.',
            )
          },
        )


      return () => {
        active =
          false
      }
    },
    [
      sessionResolved,
      session,
      identityAttempt,
    ],
  )


  async function signIn(
    email: string,
    password: string,
  ): Promise<void> {
    setSigningIn(
      true,
    )

    setError(
      null,
    )


    try {
      const supabase =
        getSupabaseBrowserClient()

      const {
        data,
        error:
          signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password,
          })


      if (signInError) {
        setStatus(
          'anonymous',
        )

        setError(
          signInError.message,
        )

        return
      }


      setSession(
        data.session,
      )

      setSessionResolved(
        true,
      )
    } finally {
      setSigningIn(
        false,
      )
    }
  }


  async function signOut():
    Promise<void> {
    setSigningOut(
      true,
    )


    try {
      const supabase =
        getSupabaseBrowserClient()

      const {
        error:
          signOutError,
      } =
        await supabase.auth
          .signOut({
            scope:
              'local',
          })


      if (signOutError) {
        setError(
          signOutError.message,
        )

        return
      }


      setSession(
        null,
      )

      setUser(
        null,
      )

      setError(
        null,
      )

      setStatus(
        'anonymous',
      )
    } finally {
      setSigningOut(
        false,
      )
    }
  }


  function retryIdentity():
    void {
    setIdentityAttempt(
      (current) =>
        current + 1,
    )
  }


  return {
    status,
    user,
    error,
    hasSession:
      session !== null,
    signingIn,
    signingOut,
    signIn,
    signOut,
    retryIdentity,
  }
}
