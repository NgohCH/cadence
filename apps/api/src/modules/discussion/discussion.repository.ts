import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "./discussion.types";

export interface DiscussionRepository {
  createMessage(
    input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage>;

  getMessageVersion(
    projectId: string,
    messageId: string,
    versionNumber: number
  ): Promise<DiscussionMessageVersion | null>;
}