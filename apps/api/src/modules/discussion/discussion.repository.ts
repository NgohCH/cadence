import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "./discussion.types";

export interface DiscussionRepository {
  createMessage(
    input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage>;

  listProjectMessages(
    projectId: string
  ): Promise<DiscussionMessage[]>;

  getMessageVersion(
    projectId: string,
    messageId: string,
    versionNumber: number
  ): Promise<DiscussionMessageVersion | null>;
}
