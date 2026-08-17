import type {
  CadenceUser,
} from '../../types/identity'

import type {
  ProjectSummaryResponse,
} from '../../types/projects'


interface WorkspaceShellProps {
  user: CadenceUser
  project: ProjectSummaryResponse
  signingOut: boolean
  onSignOut: () => Promise<void>
}


export function WorkspaceShell({
  user,
  project,
  signingOut,
  onSignOut,
}: WorkspaceShellProps) {
  const lifecycleLabel =
    project.project.lifecycle_status
      .replaceAll('_', ' ')

  const healthLabel =
    project.project.health_status
      .replaceAll('_', ' ')


  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">
            Cadence
          </div>

          <div className="brand-subtitle">
            Project Workspace
          </div>
        </div>

        <div className="topbar-user">
          <div className="user-identity">
            <strong>
              {user.display_name}
            </strong>

            <small>
              {user.email}
            </small>
          </div>

          <button
            className="signout-button"
            type="button"
            disabled={signingOut}
            onClick={() => {
              void onSignOut()
            }}
          >
            {signingOut
              ? 'Signing out...'
              : 'Sign out'}
          </button>
        </div>
      </header>

      <div className="page">
        <aside className="sidebar">
          <nav className="navigation">
            <button
              className="nav-item nav-item-active"
              type="button"
            >
              Workspace
            </button>

            <button
              className="nav-item"
              type="button"
            >
              My Tasks
            </button>
          </nav>
        </aside>

        <main className="workspace">
          <section className="workspace-heading">
            <div>
              <p className="eyebrow">
                PROJECT WORKSPACE
              </p>

              <h1>
                {project.project.name}
              </h1>

              <p className="muted">
                {project.project.description ??
                  project.project.goal ??
                  'Cadence project workspace'}
              </p>
            </div>
          </section>

          <section className="summary-grid">
            <article className="summary-card">
              <span className="summary-label">
                Project status
              </span>

              <strong className="status">
                <span className="status-dot" />
                {lifecycleLabel}
              </strong>

              <small className="muted">
                Health: {healthLabel}
              </small>
            </article>

            <article className="summary-card">
              <span className="summary-label">
                My pending tasks
              </span>

              <strong className="summary-number">
                {project.my_tasks.pending}
              </strong>

              <small className="muted">
                {project.my_tasks.overdue} overdue
              </small>
            </article>

            <article className="summary-card">
              <span className="summary-label">
                Alerts
              </span>

              <strong className="summary-number">
                {project.alerts.length}
              </strong>

              <small className="muted">
                {project.blockers} blockers
              </small>
            </article>
          </section>

          {project.alerts.length > 0 ? (
            <section className="project-alerts">
              {project.alerts.map(
                (alert) => (
                  <div
                    className={`alert-banner alert-${alert.severity}`}
                    key={alert.id}
                  >
                    <strong>
                      {alert.title}
                    </strong>

                    <span>
                      {alert.message}
                    </span>
                  </div>
                ),
              )}
            </section>
          ) : (
            <section className="alert-banner">
              No active project alerts.
            </section>
          )}

          <section className="project-detail-grid">
            <article className="summary-card">
              <span className="summary-label">
                Progress
              </span>

              <strong>
                {project.project.progress_percent}%
              </strong>

              <div className="progress-track">
                <div
                  className="progress-value"
                  style={{
                    width:
                      `${project.project.progress_percent}%`,
                  }}
                />
              </div>
            </article>

            <article className="summary-card">
              <span className="summary-label">
                Next milestone
              </span>

              {project.next_milestone ? (
                <>
                  <strong>
                    {project.next_milestone.title}
                  </strong>

                  <small className="muted">
                    {project.next_milestone.target_date}
                  </small>
                </>
              ) : (
                <strong>
                  No upcoming milestone
                </strong>
              )}
            </article>
          </section>

          <section className="workspace-grid">
            <article className="panel discussion-panel">
              <header className="panel-header">
                <div>
                  <h2>
                    Discussion
                  </h2>

                  <p className="muted">
                    Collaborate with your project
                    team and Team Agent.
                  </p>
                </div>
              </header>

              <div className="discussion-empty">
                <strong>
                  Discussion is ready for integration.
                </strong>

                <p>
                  Messages from the Cadence API
                  will appear here.
                </p>
              </div>

              <div className="composer">
                <textarea
                  rows={3}
                  placeholder="Write a project message..."
                  disabled
                />

                <button
                  type="button"
                  disabled
                >
                  Send
                </button>
              </div>
            </article>

            <aside className="panel journey-panel">
              <header className="panel-header">
                <div>
                  <h2>
                    Task Journey
                  </h2>

                  <p className="muted">
                    VS-001 workflow
                  </p>
                </div>
              </header>

              <ol className="journey">
                <li>
                  <span>1</span>
                  <div>
                    <strong>
                      Discussion
                    </strong>
                    <small>
                      Human conversation
                    </small>
                  </div>
                </li>

                <li>
                  <span>2</span>
                  <div>
                    <strong>
                      Team Agent
                    </strong>
                    <small>
                      Task proposal
                    </small>
                  </div>
                </li>

                <li>
                  <span>3</span>
                  <div>
                    <strong>
                      Human Review
                    </strong>
                    <small>
                      Approve or reject
                    </small>
                  </div>
                </li>

                <li>
                  <span>4</span>
                  <div>
                    <strong>
                      Task
                    </strong>
                    <small>
                      Authoritative record
                    </small>
                  </div>
                </li>

                <li>
                  <span>5</span>
                  <div>
                    <strong>
                      Audit
                    </strong>
                    <small>
                      Traceable journey
                    </small>
                  </div>
                </li>
              </ol>
            </aside>
          </section>
        </main>
      </div>
    </div>
  )
}