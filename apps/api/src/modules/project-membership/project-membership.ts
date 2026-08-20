import {
  ProjectMembershipValidationError,
} from "./project-membership.errors";

import {
  PROJECT_MEMBERSHIP_STATUSES,
} from "./project-membership.types";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
  ProjectMembershipStatus,
} from "./project-membership.types";


/**
 * Creates a validated domain representation without persisting it.
 */
export function createProjectMembership(
  input: CreateProjectMembershipInput
): ProjectMembership {
  assertMembershipStatus(
    input.status
  );

  const effectiveFrom =
    normalizeTimestamp(
      input.effectiveFrom,
      "effectiveFrom"
    );

  const effectiveTo =
    input.effectiveTo === null
      ? null
      : normalizeTimestamp(
          input.effectiveTo,
          "effectiveTo"
        );

  const createdAt =
    normalizeTimestamp(
      input.createdAt,
      "createdAt"
    );

  assertValidMembershipPeriod(
    effectiveFrom,
    effectiveTo
  );

  if (
    input.status === "ENDED" &&
    effectiveTo === null
  ) {
    throw new ProjectMembershipValidationError(
      "An ended membership must have an effectiveTo timestamp."
    );
  }

  return {
    ...input,
    effectiveFrom,
    effectiveTo,
    createdAt,
    terminationReason:
      normalizeOptionalText(
        input.terminationReason
      ),
  };
}


/**
 * Determines whether a membership was effective at an explicit instant.
 *
 * The interval is half-open: effectiveFrom is inclusive and effectiveTo is
 * exclusive. A null effectiveTo means the membership is open-ended.
 *
 * ENDED describes the membership's current lifecycle state; it does not
 * erase the historical interval during which the membership was effective.
 */
export function isProjectMembershipEffectiveAt(
  membership: ProjectMembership,
  evaluatedAt: string
): boolean {
  assertMembershipStatus(
    membership.status
  );

  const effectiveFrom =
    parseTimestamp(
      membership.effectiveFrom,
      "effectiveFrom"
    );

  const effectiveTo =
    membership.effectiveTo === null
      ? null
      : parseTimestamp(
          membership.effectiveTo,
          "effectiveTo"
        );

  assertValidMembershipPeriod(
    membership.effectiveFrom,
    membership.effectiveTo
  );

  const evaluationTime =
    parseTimestamp(
      evaluatedAt,
      "evaluatedAt"
    );

  return (
    evaluationTime >= effectiveFrom &&
    (
      effectiveTo === null ||
      evaluationTime < effectiveTo
    )
  );
}


function assertMembershipStatus(
  status: ProjectMembershipStatus
): void {
  if (
    !(
      PROJECT_MEMBERSHIP_STATUSES as
        readonly string[]
    ).includes(status)
  ) {
    throw new ProjectMembershipValidationError(
      `Unsupported project membership status: ${status}.`
    );
  }
}


function assertValidMembershipPeriod(
  effectiveFrom: string,
  effectiveTo: string | null
): void {
  const from =
    parseTimestamp(
      effectiveFrom,
      "effectiveFrom"
    );

  if (effectiveTo === null) {
    return;
  }

  const to =
    parseTimestamp(
      effectiveTo,
      "effectiveTo"
    );

  if (to <= from) {
    throw new ProjectMembershipValidationError(
      "effectiveTo must be later than effectiveFrom."
    );
  }
}


function normalizeTimestamp(
  value: string,
  fieldName: string
): string {
  return new Date(
    parseTimestamp(
      value,
      fieldName
    )
  ).toISOString();
}


function parseTimestamp(
  value: string,
  fieldName: string
): number {
  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new ProjectMembershipValidationError(
      `${fieldName} must be a valid timestamp.`
    );
  }

  return timestamp;
}


function normalizeOptionalText(
  value: string | null
): string | null {
  if (value === null) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}
