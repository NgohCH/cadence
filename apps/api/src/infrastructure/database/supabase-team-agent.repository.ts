import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  TeamAgentRepository,
} from "../../modules/team-agent/team-agent.repository";

import type {
  CreateTaskProposalInput,
  TaskProposalProcessingResult,
} from "../../modules/team-agent/team-agent.types";


type TaskProposalProcessingRow = {
  ai_run_id: string;
  proposal_id: string;
  created: boolean;
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
}