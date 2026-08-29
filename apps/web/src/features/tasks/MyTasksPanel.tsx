import type {
  MyTask,
} from '../../types/tasks'

import {
  TaskAuditPanel,
} from '../audit/TaskAuditPanel'

import {
  useMyTasks,
} from './useMyTasks'


interface MyTasksPanelProps {
  selectedTaskId:
    string | null

  onSelectTask:
    (
      task: MyTask,
    ) => void
}


function formatTaskStatus(
  status: MyTask['status'],
): string {
  return status
    .replaceAll(
      '_',
      ' ',
    )
}


function formatDueDate(
  dueDate:
    string | null,
): string {
  if (
    !dueDate
  ) {
    return 'No due date'
  }


  const parsed =
    new Date(
      dueDate,
    )


  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return dueDate
  }


  return parsed
    .toLocaleDateString()
}


export function MyTasksPanel({
  selectedTaskId,
  onSelectTask,
}: MyTasksPanelProps) {
  const myTasks =
    useMyTasks()

  const selectedTask =
    myTasks.tasks.find(
      (task) =>
        task.id ===
        selectedTaskId,
    ) ??
    null


  return (
    <div className="my-tasks-layout">
      <section className="panel my-tasks-panel">
        <header className="panel-header my-tasks-header">
          <div>
            <h2>
              My Tasks
            </h2>

            <p className="muted">
              Current actionable Tasks assigned
              to you.
            </p>
          </div>

          <button
            className="secondary-button compact-button"
            type="button"
            disabled={
              myTasks.loading
            }
            onClick={
              () => {
                void myTasks.refresh()
              }
            }
          >
            {myTasks.loading
              ? 'Loading...'
              : 'Refresh'}
          </button>
        </header>

        {myTasks.loading ? (
          <div className="my-tasks-state">
            Loading your Tasks...
          </div>
        ) : myTasks.error ? (
          <div className="my-tasks-state">
            <div
              className="auth-error"
              role="alert"
            >
              {myTasks.error}
            </div>
          </div>
        ) : myTasks.tasks.length ===
          0 ? (
          <div className="my-tasks-state">
            <strong>
              No actionable Tasks.
            </strong>

            <p className="muted">
              Open and in-progress Tasks
              assigned to you will appear
              here.
            </p>
          </div>
        ) : (
          <div className="my-tasks-list">
            {myTasks.tasks.map(
              (task) => {
                const selected =
                  selectedTaskId ===
                  task.id


                return (
                  <button
                    className={
                      selected
                        ? 'my-task-card my-task-card-selected'
                        : 'my-task-card'
                    }
                    key={
                      task.id
                    }
                    type="button"
                    onClick={
                      () => {
                        onSelectTask(
                          task,
                        )
                      }
                    }
                  >
                    <div className="my-task-heading">
                      <div>
                        <span className="my-task-status">
                          {formatTaskStatus(
                            task.status,
                          )}
                        </span>

                        <span className="my-task-priority">
                          {
                            task.priority
                          }
                        </span>
                      </div>

                      <span className="my-task-due">
                        {formatDueDate(
                          task.due_date,
                        )}
                      </span>
                    </div>

                    <strong className="my-task-title">
                      {
                        task.title
                      }
                    </strong>

                    {task.description && (
                      <p className="my-task-description">
                        {
                          task.description
                        }
                      </p>
                    )}

                    <dl className="my-task-details">
                      <div>
                        <dt>
                          Project
                        </dt>

                        <dd>
                          {
                            task.project_id
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Created by
                        </dt>

                        <dd>
                          {
                            task.created_by_type
                          }
                        </dd>
                      </div>
                    </dl>
                  </button>
                )
              },
            )}
          </div>
        )}
      </section>

      {selectedTask ? (
        <TaskAuditPanel
          projectId={
            selectedTask.project_id
          }
          taskId={
            selectedTask.id
          }
          taskTitle={
            selectedTask.title
          }
        />
      ) : (
        <section className="panel audit-panel">
          <header className="panel-header">
            <div>
              <h2>
                Audit Journey
              </h2>

              <p className="muted">
                Trace the history behind
                an authoritative Task.
              </p>
            </div>
          </header>

          <div className="audit-state">
            Select a Task to inspect its
            Discussion-to-Task journey.
          </div>
        </section>
      )}
    </div>
  )
}