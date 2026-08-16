import type {
  TeamAgentRepository,
} from "./team-agent.repository";

import type {
  CreateTaskProposalInput,
  ProcessMessageForTaskProposalInput,
  TaskProposalPayload,
  TaskProposalProcessingResult,
} from "./team-agent.types";


export class TeamAgentService {
  constructor(
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