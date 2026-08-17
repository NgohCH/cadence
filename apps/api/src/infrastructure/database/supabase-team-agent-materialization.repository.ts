import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  ReviewedTaskProposalForMaterialization,
  TeamAgentTaskMaterializationRepository,
} from "../../modules/team-agent/team-agent-materialization.repository";

import type {
  TaskProposalPayload,
} from "../../modules/team-agent/team-agent.types";


type ProposalRow = {
  id: string;

  project_id: string;

  status:
    | "pending"
    | "confirmed"
    | "edited"
    | "rejected"
    | "expired";

  reviewed_payload:
    TaskProposalPayload | null;

  reviewed_by:
    string | null;

  reviewed_at:
    string | null;

  result_entity_type:
    string | null;

  result_entity_id:
    string | null;
};


type ReviewEventRow = {
  id: string;

  event_type: string;

  correlation_id: string;
};


export class SupabaseTeamAgentMaterializationRepository
  implements TeamAgentTaskMaterializationRepository
{
  constructor(
    private readonly db:
      SupabaseClient
  ) {}


  async getReviewedTaskProposal(
    projectId: string,
    proposalId: string
  ): Promise<ReviewedTaskProposalForMaterialization | null> {
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
          status,
          reviewed_payload,
          reviewed_by,
          reviewed_at,
          result_entity_type,
          result_entity_id
        `
      )
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        proposalId
      )
      .maybeSingle();


    if (error) {
      throw new Error(
        `Failed to load reviewed Team Agent proposal: ${error.message}`
      );
    }


    if (!data) {
      return null;
    }


    const proposal =
      data as ProposalRow;


    const {
      data:
        reviewEvents,

      error:
        reviewEventError,
    } = await this.db
      .from(
        "domain_events"
      )
      .select(
        `
          id,
          event_type,
          correlation_id
        `
      )
      .eq(
        "aggregate_type",
        "ai_proposal"
      )
      .eq(
        "aggregate_id",
        proposalId
      )
      .eq(
        "event_version",
        1
      )
      .in(
        "event_type",
        [
          "AIProposalConfirmed",
          "AIProposalEdited",
        ]
      )
      .order(
        "occurred_at",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      );


    if (reviewEventError) {
      throw new Error(
        `Failed to load Team Agent review event: ${reviewEventError.message}`
      );
    }


    const reviewEvent =
      (
        reviewEvents ??
        []
      )[0] as
        ReviewEventRow |
        undefined;


    return {
      proposalId:
        proposal.id,

      projectId:
        proposal.project_id,

      status:
        proposal.status,

      reviewedPayload:
        proposal.reviewed_payload,

      reviewedBy:
        proposal.reviewed_by,

      reviewedAt:
        proposal.reviewed_at,

      reviewEventId:
        reviewEvent?.id ??
        null,

      reviewCorrelationId:
        reviewEvent?.correlation_id ??
        null,

      resultEntityType:
        proposal.result_entity_type,

      resultEntityId:
        proposal.result_entity_id,
    };
  }


  async recordTaskResult(
    projectId: string,
    proposalId: string,
    taskId: string
  ): Promise<void> {
    /*
     * This update remains Team-Agent-owned persistence.
     *
     * It records which authoritative entity resulted from the
     * proposal. It does not create or modify the Task itself.
     */
    const {
      data,
      error,
    } = await this.db
      .from(
        "ai_proposals"
      )
      .update({
        result_entity_type:
          "task",

        result_entity_id:
          taskId,
      })
      .eq(
        "project_id",
        projectId
      )
      .eq(
        "id",
        proposalId
      )
      .in(
        "status",
        [
          "confirmed",
          "edited",
        ]
      )
      .select(
        "id"
      )
      .maybeSingle();


    if (error) {
      throw new Error(
        `Failed to record authoritative Task result on Team Agent proposal: ${error.message}`
      );
    }


    if (!data) {
      throw new Error(
        "Reviewed Team Agent proposal could not be linked to its authoritative Task."
      );
    }
  }
}
