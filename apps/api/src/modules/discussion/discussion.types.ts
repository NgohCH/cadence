export interface CreateDiscussionMessageInput {
  projectId: string;
  authorUserId: string;
  content: string;
  threadParentId: string | null;
  correlationId: string;
  causationId: string | null;
}

export interface DiscussionMessage {
  id: string;
  projectId: string;
  authorUserId: string | null;
  authorType: "human" | "agent" | "system";
  threadParentId: string | null;
  currentVersion: number;
  content: string;
  createdAt: string;
  editedAt: string | null;
}
