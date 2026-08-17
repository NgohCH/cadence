import type {
  RequestContext,
} from "../../bootstrap/request-context";

import {
  RbacService,
} from "../rbac/rbac.service";

import type {
  TasksService,
} from "../tasks/tasks.service";

import type {
  TaskCreationResult,
} from "../tasks/tasks.types";

import {
  TeamAgentProjectNotFoundError,
  TeamAgentProposalNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";

import type {
  TeamAgentTaskMaterializationRepository,
} from "./team-agent-materialization.repository";


export class TeamAgentTaskMaterializationService {
  constructor(
    private readonly rbacService:
      RbacService,

    private readonly repository:
      TeamAgentTaskMaterializationRepository,

    private readonly tasksService:
      Pick<
        TasksService,
        "createTask"
      >
  ) {}


  async createTaskFromReviewedProposal(
    context: RequestContext,
    projectId: string,
    proposalId: string
  ): Promise<TaskCreationResult> {
    /*
     * Check project membership before revealing proposal state.
     *
     * Task-specific permission enforcement remains the
     * responsibility of TasksService.
     */
    const access =
      await this.rbacService
        .getProjectAccess(
          context.actorUserId,
          projectId
        );


    if (!access) {
      throw new TeamAgentProjectNotFoundError();
    }


    const proposal =
      await this.repository
        .getReviewedTaskProposal(
          projectId,
          proposalId
        );


    if (!proposal) {
      throw new TeamAgentProposalNotFoundError();
    }


    /*
     * Only human-approved proposal states may cross the
     * authoritative boundary.
     */
    if (
      proposal.status !==
        "confirmed" &&
      proposal.status !==
        "edited"
    ) {
      throw new TeamAgentValidationError(
        "Only confirmed or edited task proposals can create authoritative Tasks."
      );
    }


    if (
      !proposal.reviewedPayload
    ) {
      throw new TeamAgentValidationError(
        "Reviewed proposal values are required before authoritative Task creation."
      );
    }


    /*
     * The review event is the immediate business cause of
     * TaskCreated.v1.
     */
    if (
      !proposal.reviewEventId ||
      !proposal.reviewCorrelationId
    ) {
      throw new TeamAgentValidationError(
        "Reviewed proposal is missing review-event provenance."
      );
    }


    /*
     * If the proposal has already been linked to a Task, we still
     * call TasksService.
     *
     * Tasks owns idempotency and returns the same authoritative Task.
     * Team Agent must not reconstruct or read authoritative Task
     * state directly.
     */
    const result =
      await this.tasksService
        .createTask(
          context,
          {
            projectId,

            title:
              proposal
                .reviewedPayload
                .title,

            description:
              proposal
                .reviewedPayload
                .description,

            assignedTo:
              proposal
                .reviewedPayload
                .assigned_to,

            priority:
              "normal",

            dueDate:
              proposal
                .reviewedPayload
                .due_date,

            source: {
              sourceType:
                "ai_proposal",

              sourceId:
                proposal.proposalId,
            },

            correlationId:
              proposal
                .reviewCorrelationId,

            causationId:
              proposal
                .reviewEventId,
          }
        );


    /*
     * This is intentionally after authoritative creation.
     *
     * If recording the result fails, retrying is safe because
     * TasksService/Tasks persistence is idempotent by proposal source.
     */
    await this.repository
      .recordTaskResult(
        projectId,
        proposalId,
        result.task.id
      );


    return result;
  }
}
