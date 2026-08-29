export class TeamAgentProjectNotFoundError
  extends Error
{
  constructor() {
    super("Project not found.");

    this.name =
      "TeamAgentProjectNotFoundError";
  }
}


export class TeamAgentPermissionDeniedError
  extends Error
{
  constructor() {
    super("Permission denied.");

    this.name =
      "TeamAgentPermissionDeniedError";
  }
}


export class TeamAgentValidationError
  extends Error
{
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "TeamAgentValidationError";
  }
}


export class TeamAgentProposalNotFoundError
  extends Error
{
  constructor() {
    super("Task proposal not found.");

    this.name =
      "TeamAgentProposalNotFoundError";
  }
}


export class TeamAgentProposalAlreadyReviewedError
  extends Error
{
  constructor() {
    super(
      "Task proposal has already been reviewed."
    );

    this.name =
      "TeamAgentProposalAlreadyReviewedError";
  }
}