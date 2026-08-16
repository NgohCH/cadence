import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  TeamAgentRepository,
} from "../../modules/team-agent/team-agent.repository";

import {
  TeamAgentPermissionDeniedError,
  TeamAgentProposalAlreadyReviewedError,
  TeamAgentProposalNotFoundError,
  TeamAgentValidationError,
} from "../../modules/team-agent/team-agent.errors";

import type {
  CreateTaskProposalInput,
  ReviewTaskProposalInput,
  TaskProposalPayload,
  TaskProposalProcessingResult,
  TaskProposalReviewResult,
  TaskProposalReviewStatus,
} from "../../modules/team-agent/team-agent.types";


type TaskProposalProcessingRow = {
  ai_run_id: string;
  proposal_id: string;
  created: boolean;
};


type TaskProposalReviewRow = {
  proposal_id: string;

  project_id: string;

  status:
    TaskProposalReviewStatus;

  reviewed_payload:
    TaskProposalPayload | null;

  reviewed_by: string;

  reviewed_at: string;
};


export class SupabaseTeamAgentRepository
  implements TeamAgentRepository
{
  constructor(
    private readonly db:
      SupabaseClient
  ) {}


  async createTaskProposal(
    input: CreateTaskProposalInput
  ): Promise<TaskProposalProcessingResult> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "create_team_agent_task_proposal",
      {
        p_source_event_id:
          input.sourceEventId,

        p_project_id:
          input.projectId,

        p_triggered_by_user_id:
          input.triggeredByUserId,

        p_message_id:
          input.messageId,

        p_message_version_id:
          input.messageVersionId,

        p_version_number:
          input.versionNumber,

        p_correlation_id:
          input.correlationId,

        p_model_provider:
          input.modelProvider,

        p_model_name:
          input.modelName,

        p_prompt_version_id:
          input.promptVersionId,

        p_proposal_payload:
          input.proposalPayload,

        p_confidence:
          input.confidence,

        p_reason:
          input.reason,

        p_output_raw:
          input.outputRaw,
      }
    );


    if (error) {
      throw new Error(
        `Failed to create Team Agent task proposal: ${error.message}`
      );
    }


    const rows =
      (data ?? []) as
        TaskProposalProcessingRow[];

    const row =
      rows[0];


    if (!row) {
      throw new Error(
        "Team Agent task proposal creation returned no row."
      );
    }


    return {
      aiRunId:
        row.ai_run_id,

      proposalId:
        row.proposal_id,

      created:
        row.created,
    };
  }


  async reviewTaskProposal(
    input: ReviewTaskProposalInput
  ): Promise<TaskProposalReviewResult> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "review_team_agent_task_proposal",
      {
        p_project_id:
          input.projectId,

        p_proposal_id:
          input.proposalId,

        p_reviewer_user_id:
          input.reviewerUserId,

        p_action:
          input.action,

        p_reviewed_payload:
          input.reviewedPayload,

        p_correlation_id:
          input.correlationId,
      }
    );


    if (error) {
      this.throwMappedReviewError(
        error.message
      );
    }


    const rows =
      (data ?? []) as
        TaskProposalReviewRow[];

    const row =
      rows[0];


    if (!row) {
      throw new Error(
        "Team Agent task proposal review returned no row."
      );
    }


    return {
      proposalId:
        row.proposal_id,

      projectId:
        row.project_id,

      status:
        row.status,

      reviewedPayload:
        row.reviewed_payload,

      reviewedBy:
        row.reviewed_by,

      reviewedAt:
        row.reviewed_at,
    };
  }


  private throwMappedReviewError(
    message: string
  ): never {
    if (
      message.includes(
        "TEAM_AGENT_REVIEW_PERMISSION_DENIED"
      )
    ) {
      throw new TeamAgentPermissionDeniedError();
    }


    if (
      message.includes(
        "TEAM_AGENT_PROPOSAL_NOT_FOUND"
      )
    ) {
      throw new TeamAgentProposalNotFoundError();
    }


    if (
      message.includes(
        "TEAM_AGENT_PROPOSAL_ALREADY_REVIEWED"
      )
    ) {
      throw new TeamAgentProposalAlreadyReviewedError();
    }


    if (
      message.includes(
        "TEAM_AGENT_REVIEW_REFERENCE_MISSING"
      )
    ) {
      throw new TeamAgentValidationError(
        "Required proposal review reference is missing."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_REVIEW_ACTION_INVALID"
      )
    ) {
      throw new TeamAgentValidationError(
        "Review action must be confirm, edit, or reject."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_CONFIRM_PAYLOAD_NOT_ALLOWED"
      )
    ) {
      throw new TeamAgentValidationError(
        "Confirmed proposals must not include edited values."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_REJECT_PAYLOAD_NOT_ALLOWED"
      )
    ) {
      throw new TeamAgentValidationError(
        "Rejected proposals must not include edited values."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_EDIT_PAYLOAD_REQUIRED"
      )
    ) {
      throw new TeamAgentValidationError(
        "Edited proposal values are required."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_TASK_TITLE_REQUIRED"
      )
    ) {
      throw new TeamAgentValidationError(
        "Task title is required."
      );
    }


    if (
      message.includes(
        "TEAM_AGENT_PROPOSAL_PROVENANCE_IMMUTABLE"
      )
    ) {
      throw new TeamAgentValidationError(
        "Proposal source-message provenance cannot be changed."
      );
    }


    throw new Error(
      `Failed to review Team Agent task proposal: ${message}`
    );
  }
}