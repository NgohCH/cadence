import {
  useState,
} from 'react'

import {
  apiFetch,
} from '../../lib/api'

import type {
  ApiSuccess,
} from '../../types/api'

import type {
  PendingTaskProposal,
  TaskProposalPayload,
  TaskProposalReviewResult,
} from '../../types/teamAgent'

import {
  usePendingTaskProposals,
} from './usePendingTaskProposals'


interface ProposalReviewPanelProps {
  projectId: string
}


interface MaterializedTask {
  id: string

  project_id: string

  title: string

  description:
    string | null

  assigned_to:
    string | null

  status:
    'open' |
    'in_progress' |
    'completed' |
    'cancelled'

  priority:
    'low' |
    'normal' |
    'high' |
    'critical'

  due_date:
    string | null

  completed_at:
    string | null

  created_by:
    string | null

  created_by_type:
    'human' |
    'agent' |
    'system'

  created_at: string

  updated_at: string
}


interface TaskMaterializationResult {
  task:
    MaterializedTask

  created:
    boolean
}


export function ProposalReviewPanel({
  projectId,
}: ProposalReviewPanelProps) {
  const pending =
    usePendingTaskProposals(
      projectId,
    )

  const [
    editingProposalId,
    setEditingProposalId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    title,
    setTitle,
  ] =
    useState(
      '',
    )

  const [
    description,
    setDescription,
  ] =
    useState(
      '',
    )

  const [
    reviewingProposalId,
    setReviewingProposalId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    materializingProposalId,
    setMaterializingProposalId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    materializationRetry,
    setMaterializationRetry,
  ] =
    useState<PendingTaskProposal | null>(
      null,
    )

  const [
    actionError,
    setActionError,
  ] =
    useState<string | null>(
      null,
    )

  const [
    lastReview,
    setLastReview,
  ] =
    useState<TaskProposalReviewResult | null>(
      null,
    )

  const [
    lastTaskResult,
    setLastTaskResult,
  ] =
    useState<TaskMaterializationResult | null>(
      null,
    )


  function clearEditing():
    void {
    setEditingProposalId(
      null,
    )

    setTitle(
      '',
    )

    setDescription(
      '',
    )
  }


  function startEditing(
    proposal: PendingTaskProposal,
  ): void {
    setEditingProposalId(
      proposal.id,
    )

    setTitle(
      proposal.payload.title,
    )

    setDescription(
      proposal.payload.description ??
        '',
    )

    setActionError(
      null,
    )

    setLastTaskResult(
      null,
    )
  }


  function cancelEditing():
    void {
    clearEditing()

    setActionError(
      null,
    )
  }


  async function materializeTask(
    proposal:
      PendingTaskProposal,

    reviewKnownSucceeded:
      boolean,
  ): Promise<boolean> {
    setMaterializingProposalId(
      proposal.id,
    )

    setLastTaskResult(
      null,
    )


    try {
      const response =
        await apiFetch<
          ApiSuccess<TaskMaterializationResult>
        >(
          `/api/v1/projects/${projectId}/task-proposals/${proposal.id}/task`,
          {
            method:
              'POST',
          },
        )


      setLastTaskResult(
        response.data,
      )

      setMaterializationRetry(
        null,
      )

      setActionError(
        null,
      )


      return true
    } catch (
      materializationError:
        unknown
    ) {
      /*
       * The authoritative Task endpoint is idempotent.
       *
       * Keeping the proposal here gives the user a safe retry path
       * when review succeeded but the browser could not complete or
       * confirm Task materialisation.
       */
      setMaterializationRetry(
        proposal,
      )


      const message =
        materializationError instanceof Error
          ? materializationError.message
          : 'Unable to create the authoritative Task.'


      setActionError(
        reviewKnownSucceeded
          ? `Human review succeeded, but authoritative Task creation failed: ${message}`
          : `The review response could not be confirmed and authoritative Task creation also could not be confirmed: ${message}`,
      )


      return false
    } finally {
      setMaterializingProposalId(
        null,
      )
    }
  }


  async function retryMaterialization():
    Promise<void> {
    if (
      !materializationRetry
    ) {
      return
    }


    setActionError(
      null,
    )


    await materializeTask(
      materializationRetry,
      true,
    )

    pending.refresh()
  }


  async function submitReview(
    proposal:
      PendingTaskProposal,

    action:
      'confirm' |
      'edit' |
      'reject',
  ): Promise<void> {
    setReviewingProposalId(
      proposal.id,
    )

    setActionError(
      null,
    )

    setLastReview(
      null,
    )

    setLastTaskResult(
      null,
    )


    try {
      let reviewedPayload:
        TaskProposalPayload |
        undefined


      if (
        action ===
        'edit'
      ) {
        if (
          title
            .trim()
            .length ===
          0
        ) {
          setActionError(
            'Task title is required.',
          )

          return
        }


        reviewedPayload = {
          ...proposal.payload,

          title:
            title.trim(),

          description:
            description
              .trim()
              .length > 0
              ? description.trim()
              : null,
        }
      }


      const body =
        action ===
        'edit'
          ? {
              action,

              reviewed_payload:
                reviewedPayload,
            }
          : {
              action,
            }


      const response =
        await apiFetch<
          ApiSuccess<TaskProposalReviewResult>
        >(
          `/api/v1/projects/${projectId}/task-proposals/${proposal.id}/review`,
          {
            method:
              'POST',

            body:
              JSON.stringify(
                body,
              ),
          },
        )


      setLastReview(
        response.data,
      )

      clearEditing()


      /*
       * Rejection is terminal and deliberately does not create
       * an authoritative Task.
       */
      if (
        action ===
        'reject'
      ) {
        setMaterializationRetry(
          null,
        )

        pending.refresh()

        return
      }


      /*
       * Confirmed and edited proposals cross the authoritative
       * boundary only after human review has succeeded.
       *
       * Team Agent does not create the Task directly. This API call
       * reaches TeamAgentTaskMaterializationService, which delegates
       * authoritative creation to TasksService.
       */
      await materializeTask(
        proposal,
        true,
      )

      pending.refresh()
    } catch (
      reviewError:
        unknown
    ) {
      /*
       * A browser may lose the review HTTP response after the server
       * successfully committed the human decision.
       *
       * For confirm/edit, safely attempt authoritative materialisation.
       * The materialisation endpoint accepts only reviewed proposals
       * and is idempotent, so:
       *
       *   - if review committed, Task creation can continue;
       *   - if review did not commit, materialisation is rejected;
       *   - if the Task already exists, the existing Task is returned.
       */
      if (
        action ===
          'confirm' ||
        action ===
          'edit'
      ) {
        const materialized =
          await materializeTask(
            proposal,
            false,
          )


        if (
          materialized
        ) {
          clearEditing()

          pending.refresh()

          return
        }
      } else {
        setActionError(
          reviewError instanceof Error
            ? `${reviewError.message} Refreshing proposal state...`
            : 'Unable to confirm the proposal review result. Refreshing proposal state...',
        )
      }


      pending.refresh()
    } finally {
      setReviewingProposalId(
        null,
      )
    }
  }


  return (
    <section className="panel proposal-panel">
      <header className="panel-header proposal-header">
        <div>
          <h2>
            Team Agent
          </h2>

          <p className="muted">
            Pending task proposals requiring
            human review.
          </p>
        </div>

        <button
          className="secondary-button compact-button"
          type="button"
          disabled={
            pending.loading ||
            reviewingProposalId !==
              null ||
            materializingProposalId !==
              null
          }
          onClick={
            pending.refresh
          }
        >
          Refresh
        </button>
      </header>

      {actionError && (
        <div className="proposal-state">
          <div
            className="auth-error"
            role="alert"
          >
            {actionError}
          </div>
        </div>
      )}

      {materializationRetry && (
        <div className="proposal-state">
          <strong>
            Task creation needs attention.
          </strong>

          <p className="muted">
            The human review may already be
            recorded. Retrying Task creation is
            safe because authoritative
            materialisation is idempotent.
          </p>

          <button
            className="primary-button"
            type="button"
            disabled={
              materializingProposalId !==
              null
            }
            onClick={
              () => {
                void retryMaterialization()
              }
            }
          >
            {materializingProposalId ===
            materializationRetry.id
              ? 'Creating task...'
              : 'Retry task creation'}
          </button>
        </div>
      )}

      {lastTaskResult &&
        !actionError && (
          <div className="proposal-state">
            <p className="proposal-success">
              {lastTaskResult.created
                ? 'Authoritative Task created successfully.'
                : 'Authoritative Task already existed and was safely reused.'}
            </p>
          </div>
        )}

      {pending.loading ? (
        <div className="proposal-state">
          Loading proposals...
        </div>
      ) : pending.error ? (
        <div className="proposal-state">
          <div
            className="auth-error"
            role="alert"
          >
            {pending.error}
          </div>
        </div>
      ) : pending.proposals.length ===
        0 ? (
        <div className="proposal-state">
          <strong>
            No pending proposals.
          </strong>

          <p className="muted">
            Run the Team Agent worker after
            posting a discussion message,
            then refresh this queue.
          </p>

          {lastReview &&
            !lastTaskResult &&
            !actionError && (
              <p className="proposal-success">
                Proposal was successfully{' '}
                {lastReview.status}.
              </p>
            )}
        </div>
      ) : (
        <div className="proposal-list">
          {pending.proposals.map(
            (proposal) => {
              const isEditing =
                editingProposalId ===
                proposal.id

              const isReviewing =
                reviewingProposalId ===
                proposal.id

              const isMaterializing =
                materializingProposalId ===
                proposal.id

              const isBusy =
                isReviewing ||
                isMaterializing


              return (
                <article
                  className="proposal-card"
                  key={
                    proposal.id
                  }
                >
                  <div className="proposal-card-heading">
                    <span className="proposal-badge">
                      Pending review
                    </span>

                    <time
                      dateTime={
                        proposal.created_at
                      }
                    >
                      {new Date(
                        proposal.created_at,
                      ).toLocaleString()}
                    </time>
                  </div>

                  {isEditing ? (
                    <div className="proposal-edit-form">
                      <label>
                        Task title

                        <input
                          value={
                            title
                          }
                          disabled={
                            isBusy
                          }
                          onChange={
                            (
                              event,
                            ) => {
                              setTitle(
                                event
                                  .target
                                  .value,
                              )
                            }
                          }
                        />
                      </label>

                      <label>
                        Description

                        <textarea
                          rows={
                            4
                          }
                          value={
                            description
                          }
                          disabled={
                            isBusy
                          }
                          onChange={
                            (
                              event,
                            ) => {
                              setDescription(
                                event
                                  .target
                                  .value,
                              )
                            }
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <h3>
                        {
                          proposal
                            .payload
                            .title
                        }
                      </h3>

                      {proposal
                        .payload
                        .description && (
                        <p className="proposal-description">
                          {
                            proposal
                              .payload
                              .description
                          }
                        </p>
                      )}

                      <dl className="proposal-details">
                        <div>
                          <dt>
                            Assigned
                          </dt>

                          <dd>
                            {proposal
                              .payload
                              .assigned_to ??
                              'Unassigned'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Due
                          </dt>

                          <dd>
                            {proposal
                              .payload
                              .due_date ??
                              'Not specified'}
                          </dd>
                        </div>
                      </dl>
                    </>
                  )}

                  <div className="proposal-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            () => {
                              void submitReview(
                                proposal,
                                'edit',
                              )
                            }
                          }
                        >
                          {isMaterializing
                            ? 'Creating task...'
                            : isReviewing
                              ? 'Saving review...'
                              : 'Approve changes'}
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            cancelEditing
                          }
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            () => {
                              void submitReview(
                                proposal,
                                'confirm',
                              )
                            }
                          }
                        >
                          {isMaterializing
                            ? 'Creating task...'
                            : isReviewing
                              ? 'Confirming...'
                              : 'Confirm'}
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            () => {
                              startEditing(
                                proposal,
                              )
                            }
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="danger-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            () => {
                              void submitReview(
                                proposal,
                                'reject',
                              )
                            }
                          }
                        >
                          {isReviewing
                            ? 'Rejecting...'
                            : 'Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}