import type {
  DomainEvent,
} from "../../infrastructure/events/domain-event";

import type {
  DomainEventHandler,
} from "../../infrastructure/events/domain-event.handler";

import {
  DiscussionService,
} from "../discussion/discussion.service";

import {
  TeamAgentService,
} from "./team-agent.service";

type MessageCreatedV1Payload = {
  message_id: string;
  project_id: string;
  author_user_id: string;
  thread_parent_id: string | null;
  version_number: number;
};

export class MessageCreatedV1Handler
  implements DomainEventHandler
{
  readonly consumerName =
    "team-agent.message-created.v1";

  constructor(
    private readonly discussionService:
      DiscussionService,

    private readonly teamAgentService:
      TeamAgentService
  ) {}

  async handle(
    event: DomainEvent
  ): Promise<void> {
    if (
      event.eventType !==
        "MessageCreated" ||
      event.eventVersion !== 1
    ) {
      throw new Error(
        "Team Agent received an unsupported domain event."
      );
    }

    if (
      event.aggregateType !==
      "message"
    ) {
      throw new Error(
        "MessageCreated.v1 must reference a message aggregate."
      );
    }

    if (!event.projectId) {
      throw new Error(
        "MessageCreated.v1 is missing projectId."
      );
    }

    const payload =
      this.parsePayload(
        event.payload
      );

    if (
      payload.project_id !==
      event.projectId
    ) {
      throw new Error(
        "MessageCreated.v1 project does not match the event envelope."
      );
    }

    if (
      payload.message_id !==
      event.aggregateId
    ) {
      throw new Error(
        "MessageCreated.v1 message does not match the event aggregate."
      );
    }

    const messageVersion =
      await this.discussionService.getMessageVersion(
        event.projectId,
        payload.message_id,
        payload.version_number
      );

    if (!messageVersion) {
      throw new Error(
        "MessageCreated.v1 referenced message version was not found."
      );
    }

    await this.teamAgentService
      .processMessageForTaskProposal({
        sourceEventId:
          event.eventId,

        projectId:
          event.projectId,

        messageId:
          payload.message_id,

        messageVersionId:
          messageVersion.id,

        versionNumber:
          payload.version_number,

        content:
          messageVersion.content,

        triggeredByUserId:
          payload.author_user_id,

        correlationId:
          event.correlationId,

        occurredAt:
          event.occurredAt,
      });
  }

  private parsePayload(
    payload: unknown
  ): MessageCreatedV1Payload {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new Error(
        "MessageCreated.v1 payload is invalid."
      );
    }

    const candidate =
      payload as Record<
        string,
        unknown
      >;

    if (
      typeof candidate.message_id !==
        "string" ||
      typeof candidate.project_id !==
        "string" ||
      typeof candidate.author_user_id !==
        "string" ||
      (
        candidate.thread_parent_id !==
          null &&
        typeof candidate.thread_parent_id !==
          "string"
      ) ||
      !Number.isInteger(
        candidate.version_number
      ) ||
      (
        candidate.version_number as number
      ) <= 0
    ) {
      throw new Error(
        "MessageCreated.v1 payload is invalid."
      );
    }

    return {
      message_id:
        candidate.message_id,

      project_id:
        candidate.project_id,

      author_user_id:
        candidate.author_user_id,

      thread_parent_id:
        candidate.thread_parent_id as
          string | null,

      version_number:
        candidate.version_number as number,
    };
  }
}