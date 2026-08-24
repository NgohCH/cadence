import {
  TasksValidationError,
} from "./tasks.errors";


/**
 * Tasks-owned assessment requested by Project Membership before ending a
 * membership. Callers receive only the business decision and do not inspect
 * Task persistence or status values.
 *
 * VS002-06A defines this published contract only. Cross-module transaction
 * serialization remains a VS002-06B/06C design concern.
 */
export interface AssessMembershipResponsibilitiesInput {
  projectId: string;
  personId: string;
  evaluatedAt: string;
}


export interface MembershipResponsibilityAssessment {
  hasBlockingResponsibilities: boolean;
}


export interface TasksMembershipResponsibilityService {
  assessMembershipResponsibilities(
    input: AssessMembershipResponsibilitiesInput
  ): Promise<MembershipResponsibilityAssessment>;
}


/** Tasks-internal persistence boundary. It is not published to consumers. */
export interface TasksMembershipResponsibilityRepository {
  hasActionableAssignedResponsibilities(
    projectId: string,
    personId: string
  ): Promise<boolean>;
}


export class DefaultTasksMembershipResponsibilityService
  implements TasksMembershipResponsibilityService
{
  constructor(
    private readonly repository:
      TasksMembershipResponsibilityRepository
  ) {}


  async assessMembershipResponsibilities(
    input: AssessMembershipResponsibilitiesInput
  ): Promise<MembershipResponsibilityAssessment> {
    assertRequiredText(
      input.projectId,
      "projectId"
    );
    assertRequiredText(
      input.personId,
      "personId"
    );

    if (
      !Number.isFinite(
        Date.parse(input.evaluatedAt)
      )
    ) {
      throw new TasksValidationError(
        "evaluatedAt must be a valid timestamp."
      );
    }

    return {
      hasBlockingResponsibilities:
        await this.repository
          .hasActionableAssignedResponsibilities(
            input.projectId,
            input.personId
          ),
    };
  }
}


function assertRequiredText(
  value: string,
  fieldName: string
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new TasksValidationError(
      `${fieldName} is required.`
    );
  }
}
