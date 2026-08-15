import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DiscussionRepository,
} from "../../modules/discussion/discussion.repository";

import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
} from "../../modules/discussion/discussion.types";

import {
  DiscussionParentMessageNotFoundError,
  DiscussionPermissionDeniedError,
  DiscussionValidationError,
} from "../../modules/discussion/discussion.errors";

type DiscussionMessageRow = {
  id: string;
  project_id: string;
  author_user_id: string | null;
  author_type: "human" | "agent" | "system";
  thread_parent_id: string | null;
  current_version: number;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export class SupabaseDiscussionRepository
  implements DiscussionRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}

  async createMessage(
    input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "post_discussion_message",
      {
        p_project_id:
          input.projectId,

        p_author_user_id:
          input.authorUserId,

        p_content:
          input.content,

        p_thread_parent_id:
          input.threadParentId,

        p_correlation_id:
          input.correlationId,

        p_causation_id:
          input.causationId,
      }
    );

    if (error) {
      this.throwMappedError(
        error.message
      );
    }

    const rows =
      (data ?? []) as DiscussionMessageRow[];

    const row =
      rows[0];

    if (!row) {
      throw new Error(
        "Discussion message creation returned no row."
      );
    }

    return {
      id: row.id,
      projectId:
        row.project_id,
      authorUserId:
        row.author_user_id,
      authorType:
        row.author_type,
      threadParentId:
        row.thread_parent_id,
      currentVersion:
        row.current_version,
      content:
        row.content,
      createdAt:
        row.created_at,
      editedAt:
        row.edited_at,
    };
  }

  private throwMappedError(
    message: string
  ): never {
    if (
      message.includes(
        "DISCUSSION_PERMISSION_DENIED"
      )
    ) {
      throw new DiscussionPermissionDeniedError();
    }

    if (
      message.includes(
        "DISCUSSION_PARENT_MESSAGE_NOT_FOUND"
      )
    ) {
      throw new DiscussionParentMessageNotFoundError();
    }

    if (
      message.includes(
        "DISCUSSION_CONTENT_REQUIRED"
      )
    ) {
      throw new DiscussionValidationError(
        "Message content is required."
      );
    }

    if (
      message.includes(
        "DISCUSSION_CONTENT_TOO_LONG"
      )
    ) {
      throw new DiscussionValidationError(
        "Message content must not exceed 20000 characters."
      );
    }

    throw new Error(message);
  }
}
