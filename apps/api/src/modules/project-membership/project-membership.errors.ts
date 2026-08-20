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
