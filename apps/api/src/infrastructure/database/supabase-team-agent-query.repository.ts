import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  TeamAgentQueryRepository,
} from "../../modules/team-agent/team-agent-query.repository";

import type {
  PendingTaskProposal,
  TaskProposalPayload,
} from "../../modules/team-agent/team-agent.types";


type PendingTaskProposalRow = {
  id: string;

  project_id: string;

  ai_run_id: string;

  status: "pending";

  payload:
    TaskProposalPayload;

  confidence:
    number | string | null;

  reason:
    string | null;

  created_at:
    string;
};


export class SupabaseTeamAgentQueryRepository
  implements TeamAgentQueryRepository
{
  constructor(
    private readonly db:
      SupabaseClient
  ) {}


  async listPendingTaskProposals(
    projectId: string
  ): Promise<PendingTaskProposal[]> {
    const {
      data,
      error,
    } = await this.db
      .from(
        "ai_proposals"
      )
      .select(
        `
          id,
          project_id,
          ai_run_id,
          status,
          payload,
          confidence,
          reason,
          created_at
        `
      )
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "proposal_type",
        "task"
      )
      .eq(
        "status",
        "pending"
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );


    if (error) {
      throw new Error(
        `Failed to list pending Team Agent task proposals: ${error.message}`
      );
    }


    const rows =
      (data ?? []) as
        PendingTaskProposalRow[];


    return rows.map(
      (row) => ({
        id:
          row.id,

        projectId:
          row.project_id,

        aiRunId:
          row.ai_run_id,

        status:
          "pending",

        payload:
          row.payload,

        confidence:
          row.confidence === null
            ? null
            : Number(
                row.confidence
              ),

        reason:
          row.reason,

        createdAt:
          row.created_at,
      })
    );
  }
}