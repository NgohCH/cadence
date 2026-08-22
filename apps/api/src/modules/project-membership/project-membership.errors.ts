export class ProjectMembershipValidationError
  extends Error
{
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "ProjectMembershipValidationError";
  }
}


export class ProjectMembershipPermissionDeniedError
  extends Error
{
  constructor(
    message =
      "Project membership operation is not permitted."
  ) {
    super(message);

    this.name =
      "ProjectMembershipPermissionDeniedError";
  }
}


export class ProjectMembershipAlreadyActiveError
  extends Error
{
  constructor(
    message =
      "An overlapping project membership already exists."
  ) {
    super(message);

    this.name =
      "ProjectMembershipAlreadyActiveError";
  }
}


export class ProjectMemberPersonNotFoundError
  extends Error
{
  constructor(
    message =
      "The requested Cadence Person does not exist."
  ) {
    super(message);

    this.name =
      "ProjectMemberPersonNotFoundError";
  }
}
