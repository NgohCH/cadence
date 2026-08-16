import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  DomainEvent,
} from "../events/domain-event";

import type {
  ClaimedDomainEvent,
  DomainEventRepository,
} from "../events/domain-event.repository";

type ClaimedDomainEventRow = {
  event_id: string;
  consumer_name: string;
  claim_token: string;

  event_type: string;
  event_version: number;

  aggregate_type: string;
  aggregate_id: string;

  project_id: string | null;

  actor_type:
    | "human"
    | "agent"
    | "system";

  actor_id: string | null;

  payload: unknown;

  correlation_id: string;
  causation_id: string | null;

  occurred_at: string;

  processing_attempts: number;
};

export class SupabaseDomainEventRepository
  implements DomainEventRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}

  async claimNext(
    consumerName: string,
    leaseSeconds = 900
  ): Promise<ClaimedDomainEvent | null> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "claim_domain_event_delivery",
      {
        p_consumer_name:
          consumerName,

        p_lease_seconds:
          leaseSeconds,
      }
    );

    if (error) {
      throw new Error(
        `Failed to claim domain event delivery: ${error.message}`
      );
    }

    const rows =
      (data ?? []) as ClaimedDomainEventRow[];

    const row =
      rows[0];

    if (!row) {
      return null;
    }

    const event: DomainEvent = {
      eventId:
        row.event_id,

      eventType:
        row.event_type,

      eventVersion:
        row.event_version,

      aggregateType:
        row.aggregate_type,

      aggregateId:
        row.aggregate_id,

      correlationId:
        row.correlation_id,

      occurredAt:
        row.occurred_at,

      actorType:
        row.actor_type,

      payload:
        row.payload,
    };

    if (row.causation_id) {
      event.causationId =
        row.causation_id;
    }

    if (row.actor_id) {
      event.actorId =
        row.actor_id;
    }

    if (row.project_id) {
      event.projectId =
        row.project_id;
    }

    return {
      event,
      consumerName:
        row.consumer_name,
      claimToken:
        row.claim_token,
      processingAttempts:
        row.processing_attempts,
    };
  }

  async complete(
    eventId: string,
    consumerName: string,
    claimToken: string
  ): Promise<boolean> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "complete_domain_event_delivery",
      {
        p_event_id:
          eventId,

        p_consumer_name:
          consumerName,

        p_claim_token:
          claimToken,
      }
    );

    if (error) {
      throw new Error(
        `Failed to complete domain event delivery: ${error.message}`
      );
    }

    return data === true;
  }

  async fail(
    eventId: string,
    consumerName: string,
    claimToken: string,
    errorMessage: string,
    retryAt?: string
  ): Promise<boolean> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "fail_domain_event_delivery",
      {
        p_event_id:
          eventId,

        p_consumer_name:
          consumerName,

        p_claim_token:
          claimToken,

        p_error:
          errorMessage,

        p_retry_at:
          retryAt ?? new Date().toISOString(),
      }
    );

    if (error) {
      throw new Error(
        `Failed to mark domain event delivery as failed: ${error.message}`
      );
    }

    return data === true;
  }
}