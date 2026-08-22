import { Router } from "express";

import type {
  NextFunction,
  Response,
} from "express";

import {
  failure,
  success,
} from "../../bootstrap/api-response";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import {
  ProjectMemberPersonNotFoundError,
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipPermissionDeniedError,
  ProjectMembershipValidationError,
} from "./project-membership.errors";

import type {
  AddProjectMemberInput,
  ProjectMembershipService,
} from "./project-membership.service";


export function createProjectMembershipRouter(
  projectMembershipService:
    ProjectMembershipService
): Router {
  const router =
    Router();


  router.get(
    "/projects/:projectId/members",
    async (req, res, next) => {
      try {
        const authenticated =
          res.locals.authenticated as
            AuthenticatedRequestState;

        const {
          context,
        } = authenticated;

        const projectId =
          req.params.projectId;

        const members =
          await projectMembershipService
            .listProjectMembers(
              context,
              projectId
            );

        res.status(
          200
        ).json(
          success(
            {
              members:
                members.map(
                  (member) => ({
                    membership_id:
                      member.membership.id,

                    person_id:
                      member.person.id,

                    display_name:
                      member.person.displayName,

                    project_id:
                      member.membership.projectId,

                    roles:
                      member.roles,

                    affiliation:
                      member.affiliation
                        ? {
                            classification:
                              member
                                .affiliation
                                .classification,

                            organisation_name:
                              member
                                .affiliation
                                .organisationName,

                            effective_from:
                              member
                                .affiliation
                                .effectiveFrom,

                            effective_to:
                              member
                                .affiliation
                                .effectiveTo,
                          }
                        : null,

                    effective_from:
                      member
                        .membership
                        .effectiveFrom,

                    effective_to:
                      member
                        .membership
                        .effectiveTo,

                    status:
                      member
                        .membership
                        .status,
                  })
                ),
            },

            {
              correlation_id:
                context.correlationId,

              request_id:
                context.requestId,

              next_cursor:
                null,
            }
          )
        );
      } catch (error) {
        handleProjectMembershipError(
          error,
          res,
          next
        );
      }
    }
  );


  router.post(
    "/projects/:projectId/members",
    async (req, res, next) => {
      try {
        const authenticated =
          res.locals.authenticated as
            AuthenticatedRequestState;

        const {
          context,
        } = authenticated;

        const projectId =
          req.params.projectId;

        const input =
          parseAddProjectMemberRequest(
            req.body
          );

        const result =
          await projectMembershipService
            .addProjectMember(
              context,
              projectId,
              input
            );

        res.status(
          201
        ).json(
          success(
            {
              membership: {
                id:
                  result.membership.id,

                person_id:
                  result.membership.personId,

                project_id:
                  result.membership.projectId,

                effective_from:
                  result
                    .membership
                    .effectiveFrom,

                effective_to:
                  result
                    .membership
                    .effectiveTo,

                status:
                  result.membership.status,

                granted_by_person_id:
                  result
                    .membership
                    .grantedBy,

                created_at:
                  result
                    .membership
                    .createdAt,

                termination_reason:
                  result
                    .membership
                    .terminationReason,
              },

              role_assignment: {
                id:
                  result
                    .roleAssignment
                    .id,

                project_id:
                  result
                    .roleAssignment
                    .projectId,

                membership_id:
                  result
                    .roleAssignment
                    .membershipId,

                role:
                  result
                    .roleAssignment
                    .role,

                effective_from:
                  result
                    .roleAssignment
                    .effectiveFrom,

                effective_to:
                  result
                    .roleAssignment
                    .effectiveTo,

                assigned_by_person_id:
                  result
                    .roleAssignment
                    .assignedBy,

                change_reason:
                  result
                    .roleAssignment
                    .changeReason,

                created_at:
                  result
                    .roleAssignment
                    .createdAt,
              },
            },

            {
              correlation_id:
                context.correlationId,

              request_id:
                context.requestId,

              next_cursor:
                null,
            }
          )
        );
      } catch (error) {
        handleProjectMembershipError(
          error,
          res,
          next
        );
      }
    }
  );


  return router;
}


function parseAddProjectMemberRequest(
  body: unknown
): AddProjectMemberInput {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new ProjectMembershipValidationError(
      "Request body must be an object."
    );
  }

  const request =
    body as Record<
      string,
      unknown
    >;

  const personId =
    requireNonBlankString(
      request.person_id,
      "person_id"
    );

  const role =
    requireNonBlankString(
      request.role,
      "role"
    );

  if (
    role !==
      "PROJECT_MEMBER"
  ) {
    throw new ProjectMembershipValidationError(
      "VS002-04 add-member flow supports only PROJECT_MEMBER."
    );
  }

  const effectiveFrom =
    requireNonBlankString(
      request.effective_from,
      "effective_from"
    );

  const effectiveToValue =
    request.effective_to;

  let effectiveTo:
    string | null;

  if (
    effectiveToValue ===
      undefined ||
    effectiveToValue ===
      null
  ) {
    effectiveTo =
      null;
  } else {
    effectiveTo =
      requireNonBlankString(
        effectiveToValue,
        "effective_to"
      );
  }

  return {
    personId,
    role:
      "PROJECT_MEMBER",
    effectiveFrom,
    effectiveTo,
  };
}


function requireNonBlankString(
  value: unknown,
  fieldName: string
): string {
  if (
    typeof value !==
      "string" ||
    value.trim().length ===
      0
  ) {
    throw new ProjectMembershipValidationError(
      `${fieldName} is required.`
    );
  }

  return value.trim();
}


function handleProjectMembershipError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  const authenticated =
    res.locals.authenticated as
      AuthenticatedRequestState;

  const correlationId =
    authenticated
      .context
      .correlationId;

  if (
    error instanceof
      ProjectMembershipPermissionDeniedError
  ) {
    res.status(
      403
    ).json(
      failure(
        "PROJECT_ACCESS_DENIED",
        "You do not have permission to perform this project membership operation.",
        correlationId
      )
    );

    return;
  }

  if (
    error instanceof
      ProjectMembershipAlreadyActiveError
  ) {
    res.status(
      409
    ).json(
      failure(
        "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
        "An overlapping active project membership already exists.",
        correlationId
      )
    );

    return;
  }

  if (
    error instanceof
      ProjectMemberPersonNotFoundError
  ) {
    res.status(
      404
    ).json(
      failure(
        "NOT_FOUND",
        "Cadence Person not found.",
        correlationId
      )
    );

    return;
  }

  if (
    error instanceof
      ProjectMembershipValidationError
  ) {
    res.status(
      400
    ).json(
      failure(
        "VALIDATION_ERROR",
        error.message,
        correlationId
      )
    );

    return;
  }

  next(
    error
  );
}
