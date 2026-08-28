import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";
import type {
  TeamAgentRepository,
} from "./team-agent.repository";

import type {
  CreateTaskProposalInput,
  ProcessMessageForTaskProposalInput,
  TaskProposalPayload,
  TaskProposalProcessingResult,
  TaskProposalReviewAction,
  TaskProposalReviewResult,
} from "./team-agent.types";

import {
  TeamAgentPermissionDeniedError,
  TeamAgentProjectNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";


export interface TeamAgentAuthorisationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}

export class TeamAgentService {
  constructor(
    private readonly authorisationService:
      TeamAgentAuthorisationService,

    private readonly repository:
      TeamAgentRepository
  ) {}


  async processMessageForTaskProposal(
    input: ProcessMessageForTaskProposalInput
  ): Promise<TaskProposalProcessingResult> {
    const content =
      input.content
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    if (content.length === 0) {
      throw new Error(
        "Team Agent cannot process an empty message."
      );
    }


    const proposalPayload:
      TaskProposalPayload = {
        title:
          this.createDevelopmentTitle(
            content
          ),

        description:
          content,

        /*
         * VS001-05 deliberately does not resolve names such as
         * "Daniel" into authoritative Cadence user IDs yet.
         */
        assigned_to:
          null,

        /*
         * VS001-05 deliberately does not resolve relative dates such
         * as "Friday" into an authoritative due date yet.
         */
        due_date:
          null,

        source_message_id:
          input.messageId,

        source_message_version_id:
          input.messageVersionId,
      };


    const persistenceInput:
      CreateTaskProposalInput = {
        sourceEventId:
          input.sourceEventId,

        projectId:
          input.projectId,

        triggeredByUserId:
          input.triggeredByUserId,

        messageId:
          input.messageId,

        messageVersionId:
          input.messageVersionId,

        versionNumber:
          input.versionNumber,

        correlationId:
          input.correlationId,

        /*
         * This is explicitly a development baseline, not an external
         * LLM invocation. Later AI adapters can replace this without
         * changing the Team Agent persistence contract.
         */
        modelProvider:
          "cadence-development",

        modelName:
          "deterministic-task-proposal-v1",

        promptVersionId:
          null,

        proposalPayload,

        /*
         * No model confidence is fabricated for the deterministic
         * development implementation.
         */
        confidence:
          null,

        reason:
          "VS001-05 deterministic development proposal generated from MessageCreated.v1.",

        outputRaw: {
          generator:
            "deterministic-task-proposal-v1",

          occurred_at:
            input.occurredAt,
        },
      };


    return this.repository.createTaskProposal(
      persistenceInput
    );
  }


  async reviewTaskProposal(
    context: RequestContext,
    projectId: string,
    proposalId: string,
    action: TaskProposalReviewAction,
    reviewedPayload:
      TaskProposalPayload | null = null
  ): Promise<TaskProposalReviewResult> {
    /*
     * Human proposal review is project-scoped.
     *
     * Resolve project access first so a caller outside the project
     * receives the same project-not-found behaviour used by other
     * Cadence project-scoped services.
     */
    const authorisation =
      await this.authorisationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          projectId
        );


    if (
      authorisation.membershipIds.length === 0
    ) {
      throw new TeamAgentProjectNotFoundError();
    }


    /*
     * Authorisation is permission-based rather than role-based.
     *
     * Roles may change over time without changing this module.
     */
    if (
      !authorisation.permissions.includes(
        "agent.approve"
      )
    ) {
      throw new TeamAgentPermissionDeniedError();
    }


    /*
     * Runtime validation remains necessary even though TypeScript
     * restricts callers at compile time. HTTP input is untrusted.
     */
    if (
      action !== "confirm" &&
      action !== "edit" &&
      action !== "reject"
    ) {
      throw new TeamAgentValidationError(
        "Review action must be confirm, edit, or reject."
      );
    }


    if (action === "edit") {
      if (!reviewedPayload) {
        throw new TeamAgentValidationError(
          "Edited proposal values are required."
        );
      }


      const title =
        reviewedPayload.title.trim();


      if (title.length === 0) {
        throw new TeamAgentValidationError(
          "Task title is required."
        );
      }


      return this.repository
        .reviewTaskProposal({
          projectId,

          proposalId,

          reviewerUserId:
            context.actorUserId,

          action,

          reviewedPayload: {
            ...reviewedPayload,

            title,
          },

          correlationId:
            context.correlationId,
        });
    }


    /*
     * Confirm and reject never accept replacement proposal values.
     *
     * For confirm, the persistence operation copies the immutable
     * original AI payload into reviewed_payload.
     *
     * For reject, reviewed_payload remains null.
     */
    if (reviewedPayload !== null) {
      throw new TeamAgentValidationError(
        `${action === "confirm"
          ? "Confirmed"
          : "Rejected"} proposals must not include edited values.`
      );
    }


    return this.repository
      .reviewTaskProposal({
        projectId,

        proposalId,

        reviewerUserId:
          context.actorUserId,

        action,

        reviewedPayload:
          null,

        correlationId:
          context.correlationId,
      });
  }


  private createDevelopmentTitle(
    content: string
  ): string {
    const maximumLength =
      160;


    if (
      content.length <=
      maximumLength
    ) {
      return content;
    }


    return (
      content.slice(
        0,
        maximumLength - 3
      )
      + "..."
    );
  }
}
