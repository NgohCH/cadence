import type {
  CadenceUser,
} from '../../types/identity'


interface WorkspaceShellProps {
  user: CadenceUser
  signingOut: boolean
  onSignOut: () => Promise<void>
}


export function WorkspaceShell({
  user,
  signingOut,
  onSignOut,
}: WorkspaceShellProps) {
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
                VS-001 Pilot Project
              </h1>

              <p className="muted">
                Discussion-to-task workflow
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
                Active
              </strong>
            </article>

            <article className="summary-card">
              <span className="summary-label">
                My pending tasks
              </span>

              <strong className="summary-number">
                0
              </strong>
            </article>

            <article className="summary-card">
              <span className="summary-label">
                Alerts
              </span>

              <strong>
                No active alerts
              </strong>
            </article>
          </section>

          <section className="alert-banner">
            No critical project issues or deadlines
            currently require attention.
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
