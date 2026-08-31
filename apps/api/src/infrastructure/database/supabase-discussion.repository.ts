import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DiscussionRepository,
} from "../../modules/discussion/discussion.repository";

import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "../../modules/discussion/discussion.types";

import {
  DiscussionParentMessageNotFoundError,
  DiscussionValidationError,
} from "../../modules/discussion/discussion.errors";


type DiscussionMessageRow = {
  id: string;
  project_id: string;
  author_user_id: string | null;
  author_type:
    | "human"
    | "agent"
    | "system";
  thread_parent_id: string | null;
  current_version: number;
  content: string;
  created_at: string;
  edited_at: string | null;
};


type DiscussionMessageVersionRow = {
  id: string;
  message_id: string;
  version_number: number;
  content: string;
  editor_user_id: string | null;
  editor_type:
    | "human"
    | "agent"
    | "system";
  change_reason: string | null;
  created_at: string;
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
      id:
        row.id,

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


  async listProjectMessages(
    projectId: string
  ): Promise<DiscussionMessage[]> {
    const {
      data,
      error,
    } = await this.db
      .from("current_messages")
      .select(
        "id, project_id, author_user_id, author_type, thread_parent_id, current_version, content, created_at, edited_at"
      )
      .eq(
        "project_id",
        projectId
      )
      .order(
        "created_at",
        { ascending: true }
      )
      .order(
        "id",
        { ascending: true }
      );

    if (error) {
      throw new Error(
        `Failed to read discussion messages: ${error.message}`
      );
    }

    const rows =
      (data ?? []) as DiscussionMessageRow[];

    return rows.map((row) => ({
      id:
        row.id,

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
    }));
  }


  async getMessageVersion(
    projectId: string,
    messageId: string,
    versionNumber: number
  ): Promise<DiscussionMessageVersion | null> {
    const {
      data,
      error,
    } = await this.db
      .from("message_versions")
      .select(`
        id,
        message_id,
        version_number,
        content,
        editor_user_id,
        editor_type,
        change_reason,
        created_at,
        messages!inner(project_id)
      `)
      .eq(
        "message_id",
        messageId
      )
      .eq(
        "version_number",
        versionNumber
      )
      .eq(
        "messages.project_id",
        projectId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to read discussion message version: ${error.message}`
      );
    }

    if (!data) {
      return null;
    }

    const row =
      data as unknown as
        DiscussionMessageVersionRow;

    return {
      id:
        row.id,

      messageId:
        row.message_id,

      projectId,

      versionNumber:
        row.version_number,

      content:
        row.content,

      editorUserId:
        row.editor_user_id,

      editorType:
        row.editor_type,

      changeReason:
        row.change_reason,

      createdAt:
        row.created_at,
    };
  }


  private throwMappedError(
    message: string
  ): never {
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
