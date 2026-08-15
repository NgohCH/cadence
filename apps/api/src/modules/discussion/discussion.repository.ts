import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
} from "./discussion.types";

export interface DiscussionRepository {
  createMessage(
    input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage>;
}
