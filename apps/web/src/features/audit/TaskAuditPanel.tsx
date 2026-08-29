import type {
  AuditJourneyEvent,
} from '../../types/audit'

import {
  useTaskAudit,
} from './useTaskAudit'


interface TaskAuditPanelProps {
  projectId: string
  taskId: string
  taskTitle: string
}


function formatDateTime(
  value: string,
): string {
  const date =
    new Date(
      value,
    )


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }


  return date
    .toLocaleString()
}


function formatJson(
  value: unknown,
): string {
  if (
    value === null
  ) {
    return 'null'
  }


  try {
    return JSON.stringify(
      value,
      null,
      2,
    )
  } catch {
    return String(
      value,
    )
  }
}


function hasEventData(
  event: AuditJourneyEvent,
): boolean {
  return (
    event.before_state !==
      null ||
    event.after_state !==
      null ||
    event.metadata !==
      null
  )
}


export function TaskAuditPanel({
  projectId,
  taskId,
  taskTitle,
}: TaskAuditPanelProps) {
  const audit =
    useTaskAudit(
      projectId,
      taskId,
    )


  return (
    <section className="panel audit-panel">
      <header className="panel-header audit-header">
        <div>
          <h2>
            Audit Journey
          </h2>

          <p className="muted">
            {taskTitle}
          </p>
        </div>

        <button
          className="secondary-button compact-button"
          type="button"
          disabled={
            audit.loading
          }
          onClick={
            () => {
              void audit.refresh()
            }
          }
        >
          {audit.loading
            ? 'Loading...'
            : 'Refresh'}
        </button>
      </header>

      {audit.loading ? (
        <div className="audit-state">
          Reconstructing the Task
          journey...
        </div>
      ) : audit.error ? (
        <div className="audit-state">
          <div
            className="auth-error"
            role="alert"
          >
            {audit.error}
          </div>
        </div>
      ) : audit.journey ? (
        <>
          <section className="audit-summary">
            <div>
              <span className="summary-label">
                Journey events
              </span>

              <strong>
                {
                  audit
                    .journey
                    .events
                    .length
                }
              </strong>
            </div>

            <div>
              <span className="summary-label">
                Historical correlations
              </span>

              <strong>
                {
                  audit
                    .journey
                    .correlation_count
                }
              </strong>
            </div>
          </section>

          <section className="audit-correlation-section">
            <strong>
              Business journey correlations
            </strong>

            <div className="audit-id-list">
              {audit
                .journey
                .correlation_ids
                .map(
                  (
                    correlationId,
                  ) => (
                    <code
                      key={
                        correlationId
                      }
                    >
                      {
                        correlationId
                      }
                    </code>
                  ),
                )}
            </div>

            {audit.requestCorrelationId && (
              <div className="audit-request-correlation">
                <span className="summary-label">
                  Current Audit inspection request
                </span>

                <code>
                  {
                    audit.requestCorrelationId
                  }
                </code>

                <small className="muted">
                  This request correlation is
                  intentionally separate from the
                  historical business journey.
                </small>
              </div>
            )}
          </section>

          <ol className="audit-event-list">
            {audit
              .journey
              .events
              .map(
                (
                  event,
                  index,
                ) => (
                  <li
                    className="audit-event-card"
                    key={
                      event.domain_event_id
                    }
                  >
                    <div className="audit-event-marker">
                      {
                        index +
                        1
                      }
                    </div>

                    <div className="audit-event-content">
                      <div className="audit-event-heading">
                        <div>
                          <strong>
                            {
                              event.event_type
                            }
                            .v
                            {
                              event.event_version
                            }
                          </strong>

                          <span className="audit-action">
                            {
                              event.action
                            }
                          </span>
                        </div>

                        <time>
                          {formatDateTime(
                            event.occurred_at,
                          )}
                        </time>
                      </div>

                      <dl className="audit-event-details">
                        <div>
                          <dt>
                            Actor
                          </dt>

                          <dd>
                            {
                              event.actor_type
                            }
                            {event.actor_id
                              ? ` · ${event.actor_id}`
                              : ''}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Entity
                          </dt>

                          <dd>
                            {
                              event.entity_type
                            }
                            {' · '}
                            {
                              event.entity_id
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Correlation
                          </dt>

                          <dd>
                            <code>
                              {
                                event.correlation_id
                              }
                            </code>
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Causation
                          </dt>

                          <dd>
                            {event.causation_id ? (
                              <code>
                                {
                                  event.causation_id
                                }
                              </code>
                            ) : (
                              'None'
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Source
                          </dt>

                          <dd>
                            {event.source_type
                              ? `${event.source_type} · ${event.source_id ?? 'unknown'}`
                              : 'None'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Domain event
                          </dt>

                          <dd>
                            <code>
                              {
                                event.domain_event_id
                              }
                            </code>
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Audit event
                          </dt>

                          <dd>
                            {event.audit_event_id ? (
                              <code>
                                {
                                  event.audit_event_id
                                }
                              </code>
                            ) : (
                              'Not projected'
                            )}
                          </dd>
                        </div>
                      </dl>

                      {hasEventData(
                        event,
                      ) && (
                        <details className="audit-event-data">
                          <summary>
                            Event data
                          </summary>

                          <div>
                            <strong>
                              Before
                            </strong>

                            <pre>
                              {formatJson(
                                event.before_state,
                              )}
                            </pre>
                          </div>

                          <div>
                            <strong>
                              After
                            </strong>

                            <pre>
                              {formatJson(
                                event.after_state,
                              )}
                            </pre>
                          </div>

                          <div>
                            <strong>
                              Metadata
                            </strong>

                            <pre>
                              {formatJson(
                                event.metadata,
                              )}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                ),
              )}
          </ol>
        </>
      ) : (
        <div className="audit-state">
          Select a Task to inspect
          its audit journey.
        </div>
      )}
    </section>
  )
}