import {
  getConfiguredProjectId,
} from '../../lib/env'

import type {
  CadenceUser,
} from '../../types/identity'

import {
  WorkspaceShell,
} from './WorkspaceShell'

import {
  useProjectSummary,
} from './useProjectSummary'


interface ProjectWorkspaceProps {
  user: CadenceUser
  signingOut: boolean
  onSignOut: () => Promise<void>
}


export function ProjectWorkspace({
  user,
  signingOut,
  onSignOut,
}: ProjectWorkspaceProps) {
  const projectId =
    getConfiguredProjectId()

  const project =
    useProjectSummary(projectId)


  if (project.loading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading">
          <div className="brand">
            Cadence
          </div>

          <p>
            Loading project workspace...
          </p>
        </section>
      </main>
    )
  }


  if (
    project.error ||
    !project.summary
  ) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">
            Cadence
          </div>

          <div className="auth-heading">
            <h1>
              Project unavailable
            </h1>

            <p>
              Cadence could not load the configured
              project workspace.
            </p>
          </div>

          {project.error && (
            <div
              className="auth-error"
              role="alert"
            >
              {project.error}
            </div>
          )}

          <div className="auth-actions">
            <button
              className="primary-button"
              type="button"
              onClick={project.refresh}
            >
              Retry
            </button>

            <button
              className="secondary-button"
              type="button"
              disabled={signingOut}
              onClick={() => {
                void onSignOut()
              }}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    )
  }


  return (
    <WorkspaceShell
      user={user}
      project={project.summary}
      signingOut={signingOut}
      onSignOut={onSignOut}
    />
  )
}