export class DiscussionProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");
    this.name = "DiscussionProjectNotFoundError";
  }
}

export class DiscussionPermissionDeniedError extends Error {
  constructor() {
    super("Permission denied.");
    this.name = "DiscussionPermissionDeniedError";
  }
}

export class DiscussionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscussionValidationError";
  }
}

export class DiscussionParentMessageNotFoundError extends Error {
  constructor() {
    super("Parent message not found.");
    this.name = "DiscussionParentMessageNotFoundError";
  }
}
