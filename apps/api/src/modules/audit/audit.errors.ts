export class AuditValidationError
  extends Error
{
  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "AuditValidationError";
  }
}


export class AuditProjectNotFoundError
  extends Error
{
  constructor() {
    super(
      "Project was not found or is not accessible."
    );

    this.name =
      "AuditProjectNotFoundError";
  }
}


export class AuditPermissionDeniedError
  extends Error
{
  constructor() {
    super(
      "You do not have permission to view project audit history."
    );

    this.name =
      "AuditPermissionDeniedError";
  }
}


export class AuditJourneyNotFoundError
  extends Error
{
  constructor() {
    super(
      "Task audit journey was not found."
    );

    this.name =
      "AuditJourneyNotFoundError";
  }
}