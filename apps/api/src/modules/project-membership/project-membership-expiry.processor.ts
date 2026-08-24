import {
  randomUUID,
} from "node:crypto";

import {
  LastRequiredRoleHolderError,
} from "./project-membership.errors";

import type {
  ProjectMembershipLifecycleRepository,
} from "./project-membership-lifecycle.repository";

import type {
  ProjectMembershipTerminationResult,
} from "./project-membership-lifecycle.types";

import type {
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectMembershipClock,
  ProjectMembershipIdGenerator,
} from "./project-membership.service";


export interface MembershipExpiryConflict {
  projectId: string;
  membershipId: string;
  code: "LAST_REQUIRED_ROLE_HOLDER";
}


export interface MembershipExpiryProcessingResult {
  finalised:
    ProjectMembershipTerminationResult[];
  conflicts:
    MembershipExpiryConflict[];
}


/**
 * Materialises temporal membership expiry through Project Membership's
 * lifecycle repository. It performs no authorisation and emits no events.
 */
export class ProjectMembershipExpiryProcessor {
  constructor(
    private readonly repository:
      ProjectMembershipLifecycleRepository,

    private readonly currentTime:
      ProjectMembershipClock = () =>
        new Date().toISOString(),

    private readonly generateCorrelationId:
      ProjectMembershipIdGenerator =
        () => randomUUID()
  ) {}


  async processDueMemberships():
    Promise<MembershipExpiryProcessingResult> {
    const finalisedAt =
      normalizeTimestamp(
        this.currentTime()
      );

    const memberships =
      await this.repository
        .listDueMemberships(
          finalisedAt
        );

    const result:
      MembershipExpiryProcessingResult = {
        finalised: [],
        conflicts: [],
      };

    for (const membership of memberships) {
      if (
        !isDueMembership(
          membership,
          finalisedAt
        )
      ) {
        continue;
      }

      try {
        result.finalised.push(
          await this.repository
            .finaliseExpiry({
              projectId:
                membership.projectId,
              membershipId:
                membership.id,
              finalisedAt,
              terminationReason:
                null,
              correlationId:
                this.generateCorrelationId(),
            })
        );
      } catch (error) {
        if (
          error instanceof
            LastRequiredRoleHolderError
        ) {
          result.conflicts.push({
            projectId:
              membership.projectId,
            membershipId:
              membership.id,
            code:
              "LAST_REQUIRED_ROLE_HOLDER",
          });
          continue;
        }

        throw error;
      }
    }

    return result;
  }
}


function isDueMembership(
  membership: ProjectMembership,
  evaluatedAt: string
): boolean {
  return (
    membership.status === "ACTIVE" &&
    membership.effectiveTo !== null &&
    Date.parse(membership.effectiveTo) <=
      Date.parse(evaluatedAt)
  );
}


function normalizeTimestamp(
  value: string
): string {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      "Expiry processor clock returned an invalid timestamp."
    );
  }

  return new Date(parsed).toISOString();
}
