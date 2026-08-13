export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");

    this.name = "ProjectNotFoundError";
  }
}

export class ProjectPermissionDeniedError extends Error {
  constructor() {
    super("Permission denied.");

    this.name = "ProjectPermissionDeniedError";
  }
}