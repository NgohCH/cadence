import './index.css'

import {
  LoginScreen,
} from './features/auth/LoginScreen'

import {
  useAuth,
} from './features/auth/useAuth'

import {
  WorkspaceShell,
} from './features/workspace/WorkspaceShell'


function App() {
  const auth =
    useAuth()


  if (
    auth.status ===
    'loading'
  ) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading">
          <div className="brand">
            Cadence
          </div>

          <p>
            Checking your session...
          </p>
        </section>
      </main>
    )
  }


  if (
    auth.status ===
      'authenticated' &&
    auth.user
  ) {
    return (
      <WorkspaceShell
        user={
          auth.user
        }
        signingOut={
          auth.signingOut
        }
        onSignOut={
          auth.signOut
        }
      />
    )
  }


  return (
    <LoginScreen
      error={
        auth.error
      }
      hasSession={
        auth.hasSession
      }
      signingIn={
        auth.signingIn
      }
      signingOut={
        auth.signingOut
      }
      onSignIn={
        auth.signIn
      }
      onSignOut={
        auth.signOut
      }
      onRetryIdentity={
        auth.retryIdentity
      }
    />
  )
}


export default App
