import {
  useState,
  type FormEvent,
} from 'react'


interface LoginScreenProps {
  error: string | null
  hasSession: boolean
  signingIn: boolean
  signingOut: boolean
  onSignIn: (
    email: string,
    password: string,
  ) => Promise<void>
  onSignOut: () => Promise<void>
  onRetryIdentity: () => void
}


export function LoginScreen({
  error,
  hasSession,
  signingIn,
  signingOut,
  onSignIn,
  onSignOut,
  onRetryIdentity,
}: LoginScreenProps) {
  const [
    email,
    setEmail,
  ] =
    useState(
      '',
    )

  const [
    password,
    setPassword,
  ] =
    useState(
      '',
    )


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    await onSignIn(
      email.trim(),
      password,
    )
  }


  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand">
            Cadence
          </div>

          <p>
            Project collaboration,
            from discussion to action.
          </p>
        </div>

        {hasSession ? (
          <>
            <div className="auth-heading">
              <h1>
                Cadence access unavailable
              </h1>

              <p>
                Your authentication session exists,
                but Cadence could not validate your
                application identity.
              </p>
            </div>

            {error && (
              <div
                className="auth-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="auth-actions">
              <button
                className="primary-button"
                type="button"
                onClick={
                  onRetryIdentity
                }
              >
                Retry Cadence
              </button>

              <button
                className="secondary-button"
                type="button"
                disabled={
                  signingOut
                }
                onClick={
                  () => {
                    void onSignOut()
                  }
                }
              >
                {signingOut
                  ? 'Signing out...'
                  : 'Sign out'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-heading">
              <h1>
                Sign in
              </h1>

              <p>
                Use your Cadence pilot account
                to continue.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={
                (event) => {
                  void handleSubmit(
                    event,
                  )
                }
              }
            >
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={
                    email
                  }
                  onChange={
                    (event) =>
                      setEmail(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={
                    password
                  }
                  onChange={
                    (event) =>
                      setPassword(
                        event.target.value,
                      )
                  }
                />
              </label>

              {error && (
                <div
                  className="auth-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={
                  signingIn
                }
              >
                {signingIn
                  ? 'Signing in...'
                  : 'Sign in'}
              </button>
            </form>
          </>
        )}

        <footer className="auth-footer">
          Cadence VS-001
        </footer>
      </section>
    </main>
  )
}
