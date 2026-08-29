import {
  useState,
} from 'react'

import type {
  CadenceUser,
} from '../../types/identity'

import type {
  ProjectSummaryResponse,
} from '../../types/projects'

import type {
  MyTask,
} from '../../types/tasks'

import {
  DiscussionPanel,
} from '../discussion/DiscussionPanel'

import {
  ProposalReviewPanel,
} from '../team-agent/ProposalReviewPanel'

import {
  MyTasksPanel,
} from '../tasks/MyTasksPanel'

import { MembersPanel } from '../members/MembersPanel'
import { useProjectMembers } from '../members/useProjectMembers'


interface WorkspaceShellProps {
  user: CadenceUser
  project: ProjectSummaryResponse
  signingOut: boolean
  onSignOut: () => Promise<void>
}


type WorkspaceView =
  | 'workspace'
  | 'my_tasks'
  | 'members'


export function WorkspaceShell({
  user,
  project,
  signingOut,
  onSignOut,
}: WorkspaceShellProps) {
  const [
    activeView,
    setActiveView,
  ] =
    useState<WorkspaceView>(
      'workspace',
    )

  const [
    selectedTask,
    setSelectedTask,
  ] =
    useState<MyTask | null>(
      null,
    )


  const lifecycleLabel =
    project.project.lifecycle_status
      .replaceAll(
        '_',
        ' ',
      )

  const healthLabel =
    project.project.health_status
      .replaceAll(
        '_',
        ' ',
      )

  const members = useProjectMembers(project.project.id)


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
              className={
                activeView ===
                'workspace'
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              type="button"
              onClick={
                () => {
                  setActiveView(
                    'workspace',
                  )
                }
              }
            >
              Workspace
            </button>

            <button
              className={
                activeView ===
                'my_tasks'
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              type="button"
              onClick={
                () => {
                  setActiveView(
                    'my_tasks',
                  )
                }
              }
            >
              My Tasks
            </button>

            <button
              className={activeView === 'members' ? 'nav-item nav-item-active' : 'nav-item'}
              type="button"
              onClick={() => { setActiveView('members') }}
            >
              Members
            </button>
          </nav>
        </aside>

        <main className="workspace">
          {activeView ===
          'workspace' ? (
            <>
              <section className="workspace-heading">
                <div>
                  <p className="eyebrow">
                    PROJECT WORKSPACE
                  </p>

                  <h1>
                    {
                      project
                        .project
                        .name
                    }
                  </h1>

                  <p className="muted">
                    {project
                      .project
                      .description ??
                      project
                        .project
                        .goal ??
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

                    {
                      lifecycleLabel
                    }
                  </strong>

                  <small className="muted">
                    Health:{' '}
                    {
                      healthLabel
                    }
                  </small>
                </article>

                <article className="summary-card">
                  <span className="summary-label">
                    My pending tasks
                  </span>

                  <strong className="summary-number">
                    {
                      project
                        .my_tasks
                        .pending
                    }
                  </strong>

                  <small className="muted">
                    {
                      project
                        .my_tasks
                        .overdue
                    }{' '}
                    overdue
                  </small>
                </article>

                <article className="summary-card">
                  <span className="summary-label">
                    Alerts
                  </span>

                  <strong className="summary-number">
                    {
                      project
                        .alerts
                        .length
                    }
                  </strong>

                  <small className="muted">
                    {
                      project
                        .blockers
                    }{' '}
                    blockers
                  </small>
                </article>
              </section>

              {project.alerts.length >
              0 ? (
                <section className="project-alerts">
                  {project.alerts.map(
                    (
                      alert,
                    ) => (
                      <div
                        className={`alert-banner alert-${alert.severity}`}
                        key={
                          alert.id
                        }
                      >
                        <strong>
                          {
                            alert.title
                          }
                        </strong>

                        <span>
                          {
                            alert.message
                          }
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
                    {
                      project
                        .project
                        .progress_percent
                    }
                    %
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
                        {
                          project
                            .next_milestone
                            .title
                        }
                      </strong>

                      <small className="muted">
                        {
                          project
                            .next_milestone
                            .target_date
                        }
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
                <DiscussionPanel
                  projectId={
                    project
                      .project
                      .id
                  }
                />

                <div className="workspace-side-column">
                  <ProposalReviewPanel
                    projectId={
                      project
                        .project
                        .id
                    }
                  />

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
                        <span>
                          1
                        </span>

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
                        <span>
                          2
                        </span>

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
                        <span>
                          3
                        </span>

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
                        <span>
                          4
                        </span>

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
                        <span>
                          5
                        </span>

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
                </div>
              </section>
            </>
          ) : activeView === 'my_tasks' ? (
            <>
              <section className="workspace-heading">
                <div>
                  <p className="eyebrow">
                    MY WORK
                  </p>

                  <h1>
                    My Tasks
                  </h1>

                  <p className="muted">
                    Current actionable Tasks
                    assigned to your authenticated
                    Cadence account.
                  </p>
                </div>
              </section>

              <MyTasksPanel
                selectedTaskId={
                  selectedTask?.id ??
                  null
                }
                onSelectTask={
                  (
                    task,
                  ) => {
                    setSelectedTask(
                      task,
                    )
                  }
                }
              />
            </>
          ) : (
            <>
              <section className="workspace-heading"><div><p className="eyebrow">PROJECT ACCESS</p><h1>Members</h1><p className="muted">Current effective project membership and roles.</p></div></section>
              <MembersPanel projectId={project.project.id} {...members} onRetry={members.refresh} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
