export class TasksProjectNotFoundError
  extends Error
{
  constructor() {
    super("Project not found.");

    this.name =
      "TasksProjectNotFoundError";
  }
}


export class TasksPermissionDeniedError
  extends Error
{
  constructor() {
    super("Permission denied.");

    this.name =
      "TasksPermissionDeniedError";
  }
}


export class TasksValidationError
  extends Error
{
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "TasksValidationError";
  }
}
