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
  }


  function cancelEditing():
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

    setActionError(
      null,
    )
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

      cancelEditing()

      pending.refresh()
    } catch (
      reviewError:
        unknown
    ) {
      setActionError(
        reviewError instanceof Error
          ? `${reviewError.message} Refreshing proposal state...`
          : 'Unable to review the proposal. Refreshing proposal state...',
      )

      /*
       * Reconcile with the authoritative server state.
       *
       * A review may have been committed successfully even if
       * the browser lost the HTTP response.
       */
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
            pending.loading
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

          {lastReview && (
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
                            isReviewing
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
                            isReviewing
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
                            isReviewing
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
                          {isReviewing
                            ? 'Saving...'
                            : 'Approve changes'}
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            isReviewing
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
                            isReviewing
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
                          {isReviewing
                            ? 'Reviewing...'
                            : 'Confirm'}
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            isReviewing
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
                            isReviewing
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
                          Reject
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