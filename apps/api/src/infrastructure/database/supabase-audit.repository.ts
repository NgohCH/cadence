import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  AuditValidationError,
} from "../../modules/audit/audit.errors";

import type {
  AuditQueryRepository,
} from "../../modules/audit/audit-query.repository";

import type {
  AuditRepository,
} from "../../modules/audit/audit.repository";

import type {
  AuditJourneyEvent,
} from "../../modules/audit/audit.types";


type AuditJourneyEventRow = {
  audit_event_id:
    string | null;

  domain_event_id:
    string;

  event_type:
    string;

  event_version:
    number;

  entity_type:
    string;

  entity_id:
    string;

  action:
    string;

  actor_type:
    | "human"
    | "agent"
    | "system";

  actor_id:
    string | null;

  correlation_id:
    string;

  causation_id:
    string | null;

  source_type:
    string | null;

  source_id:
    string | null;

  occurred_at:
    string;

  before_state:
    unknown | null;

  after_state:
    unknown | null;

  metadata:
    unknown | null;
};


export class SupabaseAuditRepository
  implements
    AuditRepository,
    AuditQueryRepository
{
  constructor(
    private readonly db:
      SupabaseClient
  ) {}


  async projectDomainEvent(
    eventId: string
  ): Promise<boolean> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "project_domain_event_to_audit",
      {
        p_event_id:
          eventId,
      }
    );


    if (error) {
      throw new Error(
        `Failed to project domain event to Audit: ${error.message}`
      );
    }


    return data === true;
  }


  async getTaskJourney(
    projectId: string,
    taskId: string
  ): Promise<AuditJourneyEvent[] | null> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "get_task_audit_journey",
      {
        p_project_id:
          projectId,

        p_task_id:
          taskId,

      }
    );


    if (error) {
      this.throwQueryError(
        error.message
      );
    }


    const rows =
      (
        data ??
        []
      ) as AuditJourneyEventRow[];


    if (
      rows.length === 0
    ) {
      return null;
    }


    return rows.map(
      (row) => ({
        auditEventId:
          row.audit_event_id,

        domainEventId:
          row.domain_event_id,

        eventType:
          row.event_type,

        eventVersion:
          row.event_version,

        entityType:
          row.entity_type,

        entityId:
          row.entity_id,

        action:
          row.action,

        actorType:
          row.actor_type,

        actorId:
          row.actor_id,

        correlationId:
          row.correlation_id,

        causationId:
          row.causation_id,

        sourceType:
          row.source_type,

        sourceId:
          row.source_id,

        occurredAt:
          row.occurred_at,

        beforeState:
          row.before_state,

        afterState:
          row.after_state,

        metadata:
          row.metadata,
      })
    );
  }


  private throwQueryError(
    message: string
  ): never {


    if (
      message.includes(
        "AUDIT_REFERENCE_MISSING"
      )
    ) {
      throw new AuditValidationError(
        "Audit reconstruction references are required."
      );
    }


    throw new Error(
      `Failed to reconstruct Task audit journey: ${message}`
    );
  }
}
