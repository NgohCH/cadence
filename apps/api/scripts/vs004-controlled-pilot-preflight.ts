import { randomUUID } from "node:crypto";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthLookup,
} from "../src/infrastructure/auth/administrative-auth-provider";
import type {
  AuthenticationIdentity,
  CadencePerson,
} from "../src/modules/identity/identity.types";
import type {
  PilotCadenceUserRecord,
} from "../src/modules/identity/pilot-preparation.types";
import type {
  IdentityPilotObservationRepository,
} from "../src/modules/identity/pilot-observation.repository";
import type {
  ProjectHealthPilotObservationRepository,
} from "../src/modules/project-health/pilot-observation.repository";
import type {
  PilotProjectHealthRecord,
} from "../src/modules/project-health/pilot-preparation.types";
import type {
  ProjectMembershipPilotObservationRepository,
} from "../src/modules/project-membership/pilot-observation.repository";
import type {
  ProjectMembership,
} from "../src/modules/project-membership/project-membership.types";
import type {
  ProjectRoleAssignment,
} from "../src/modules/project-membership/project-role.types";
import type {
  ProjectRoleTransferRecord,
} from "../src/modules/project-membership/project-role-management.repository";
import type {
  ProjectsPilotObservationRepository,
} from "../src/modules/projects/pilot-observation.repository";
import type {
  PilotProjectRecord,
} from "../src/modules/projects/pilot-preparation.types";
import {
  buildPilotPreflightPlan,
  type ObservedAuthenticationIdentity,
  type ObservedAuthAccount,
  type ObservedCadenceUser,
  type ObservedMembership,
  type ObservedPerson,
  type ObservedPilotState,
  type ObservedProject,
  type ObservedProjectHealth,
  type ObservedProtectedTransfer,
  type ObservedRoleAssignment,
  type PilotPreflightInput,
  type PilotPreflightPlan,
  type PilotRuntimeTarget,
  validatePilotRuntimeTarget,
} from "./vs004-preflight";
import {
  computeManifestHash,
  validatePilotManifest,
  type PilotEnvironment,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";


export interface PilotAuthAccountReader {
  findAccounts(
    input: AdministrativeAuthLookup,
  ): Promise<readonly AdministrativeAuthAccount[]>;
}


export interface ControlledPilotObservationSources {
  readonly auth: PilotAuthAccountReader;
  readonly identity: IdentityPilotObservationRepository;
  readonly projects: ProjectsPilotObservationRepository;
  readonly projectHealth: ProjectHealthPilotObservationRepository;
  readonly membership: ProjectMembershipPilotObservationRepository;
}


export interface ControlledPilotPreflightInput {
  readonly manifest: unknown;
  readonly runtimeTarget: PilotRuntimeTarget;
  readonly runCorrelationId?: string;
}


export type ControlledPilotPreflightErrorCategory =
  | "INPUT"
  | "TARGET"
  | "IDENTITY_OBSERVATION"
  | "PROJECT_OBSERVATION"
  | "PROJECT_HEALTH_OBSERVATION"
  | "MEMBERSHIP_OBSERVATION"
  | "PREFLIGHT_CONFLICT";


export class ControlledPilotPreflightError extends Error {
  readonly category: ControlledPilotPreflightErrorCategory;
  readonly runCorrelationId: string;
  readonly manifestId: string | undefined;
  readonly manifestHash: string | undefined;

  constructor(
    category: ControlledPilotPreflightErrorCategory,
    message: string,
    context: {
      runCorrelationId: string;
      manifestId?: string;
      manifestHash?: string;
    },
  ) {
    super(message);
    this.name = "ControlledPilotPreflightError";
    this.category = category;
    this.runCorrelationId = context.runCorrelationId;
    this.manifestId = context.manifestId;
    this.manifestHash = context.manifestHash;
  }
}


export interface PreparedPilotExecution {
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly target: {
    readonly environment: PilotEnvironment;
    readonly supabaseUrl: string;
    readonly supabaseProjectRef: string | null;
    readonly projectId: string;
    readonly safeTargetMarker: string;
  };
  readonly operatorPersonId: string;
  readonly runCorrelationId: string;
  readonly validatedManifest: ValidatedPilotManifest;
  readonly observedEvidence: {
    readonly observedAt: string;
    readonly userCount: number;
    readonly personCount: number;
    readonly cadenceUserCount: number;
    readonly authenticationIdentityCount: number;
    readonly authAccountCount: number;
    readonly projectCount: number;
    readonly membershipCount: number;
    readonly roleAssignmentCount: number;
    readonly protectedTransferCount: number;
  };
  readonly preflightPlan: PilotPreflightPlan;
}


export type PilotPreflightPlanner =
  (input: PilotPreflightInput) => PilotPreflightPlan;


export async function preparePilotExecution(
  input: ControlledPilotPreflightInput,
  sources: ControlledPilotObservationSources,
  planner: PilotPreflightPlanner = buildPilotPreflightPlan,
): Promise<PreparedPilotExecution> {
  const runCorrelationId = establishRunCorrelationId(input.runCorrelationId);
  const manifestId = readManifestId(input.manifest);

  let manifest: ValidatedPilotManifest;
  try {
    manifest = validatePilotManifest(input.manifest);
  } catch (error) {
    throw controlledError(
      "INPUT",
      "Pilot manifest validation failed.",
      runCorrelationId,
      manifestId,
      undefined,
      error,
    );
  }

  const manifestHash = computeManifestHash(manifest);
  try {
    validatePilotRuntimeTarget(manifest, input.runtimeTarget);
  } catch (error) {
    throw controlledError(
      "TARGET",
      "Runtime target validation failed.",
      runCorrelationId,
      manifest.manifestId,
      manifestHash,
      error,
    );
  }

  let observed: ObservedPilotState;
  try {
    observed = await collectObservedPilotState(
      manifest,
      sources,
    );
    validateObservedPilotState(observed);
  } catch (error) {
    if (error instanceof ControlledPilotPreflightError) {
      throw new ControlledPilotPreflightError(
        error.category,
        error.message,
        {
          runCorrelationId,
          manifestId: manifest.manifestId,
          manifestHash,
        },
      );
    }
    throw controlledError(
      observationCategory(error),
      "Authoritative pilot-state observation failed.",
      runCorrelationId,
      manifest.manifestId,
      manifestHash,
      error,
    );
  }

  // This is an observation-time snapshot, not a lock or authorization grant.
  // The later executor must re-read through each owning module and fail closed
  // if state changed before mutation.
  const observedAt = new Date().toISOString();

  let preflightPlan: PilotPreflightPlan;
  try {
    preflightPlan = planner({
      manifest,
      runtimeTarget: input.runtimeTarget,
      observed,
      runCorrelationId,
    });
  } catch (error) {
    throw controlledError(
      "PREFLIGHT_CONFLICT",
      "Pilot preflight planning failed.",
      runCorrelationId,
      manifest.manifestId,
      manifestHash,
      error,
    );
  }

  return deepFreeze({
    manifestId: manifest.manifestId,
    manifestHash,
    target: {
      environment: manifest.target.environment,
      supabaseUrl: input.runtimeTarget.supabaseUrl!,
      supabaseProjectRef: input.runtimeTarget.supabaseProjectRef ?? null,
      projectId: manifest.project.id,
      safeTargetMarker: manifest.target.safeTargetMarker,
    },
    operatorPersonId: manifest.operator.personId,
    runCorrelationId,
    validatedManifest: manifest,
    observedEvidence: {
      observedAt,
      userCount: manifest.users.length,
      personCount: observed.persons.length,
      cadenceUserCount: observed.cadenceUsers.length,
      authenticationIdentityCount: observed.authenticationIdentities.length,
      authAccountCount: observed.authAccounts.length,
      projectCount: observed.projects.length,
      membershipCount: observed.memberships.length,
      roleAssignmentCount: observed.roleAssignments.length,
      protectedTransferCount: observed.protectedTransfers.length,
    },
    preflightPlan,
  });
}


async function collectObservedPilotState(
  manifest: ValidatedPilotManifest,
  sources: ControlledPilotObservationSources,
): Promise<ObservedPilotState> {
  const persons: ObservedPerson[] = [];
  const cadenceUsers: ObservedCadenceUser[] = [];
  const authenticationIdentities: AuthenticationIdentity[] = [];
  const authAccounts: ObservedAuthAccount[] = [];

  const operator = await observe(
    "IDENTITY_OBSERVATION",
    () => sources.identity.findPersonById(manifest.operator.personId),
  );
  if (operator) {
    appendById(persons, operator);
  }

  for (const user of manifest.users) {
    const person = await observe(
      "IDENTITY_OBSERVATION",
      () => sources.identity.findPersonById(user.person.id),
    );
    if (person) {
      appendById(persons, person);
    }

    const cadenceUser = await observe(
      "IDENTITY_OBSERVATION",
      () => sources.identity.findCadenceUserById(user.cadenceUser.id),
    );
    if (cadenceUser) {
      appendById(cadenceUsers, cadenceUserToObserved(cadenceUser));
    }

    const identityByPerson = await observe(
      "IDENTITY_OBSERVATION",
      () => sources.identity.listAuthenticationIdentities(user.person.id),
    );
    appendIdentities(authenticationIdentities, identityByPerson);

    if (user.authentication.identityId) {
      const identityById = await observe(
        "IDENTITY_OBSERVATION",
        () => sources.identity.findAuthenticationIdentitiesById(
          user.authentication.identityId!,
        ),
      );
      appendIdentities(authenticationIdentities, identityById);
    }

    const providerSubjectId =
      user.authentication.providerSubjectId ?? cadenceUser?.authUserId;
    if (providerSubjectId) {
      const identityBySubject = await observe(
        "IDENTITY_OBSERVATION",
        () => sources.identity.findAuthenticationIdentitiesByProviderSubject(
          user.authentication.provider,
          providerSubjectId,
        ),
      );
      appendIdentities(authenticationIdentities, identityBySubject);
    }

    const accounts = await observe(
      "IDENTITY_OBSERVATION",
      () => sources.auth.findAccounts({
        provider: user.authentication.provider,
        loginIdentifier: user.authentication.loginIdentifier,
        ...(providerSubjectId ? { providerSubjectId } : {}),
      }),
    );
    for (const account of accounts) {
      appendById(authAccounts, {
        id: account.providerSubjectId,
        provider: account.provider,
        providerSubjectId: account.providerSubjectId,
        loginIdentifier: account.loginIdentifier,
        status: account.status,
      });
    }
  }

  const project = await observe(
    "PROJECT_OBSERVATION",
    () => sources.projects.findProjectById(manifest.project.id),
  );
  const health = await observe(
    "PROJECT_HEALTH_OBSERVATION",
    () => sources.projectHealth.findCurrentProjectHealth(manifest.project.id),
  );
  const memberships = await observe(
    "MEMBERSHIP_OBSERVATION",
    () => sources.membership.listMembershipsForProject(manifest.project.id),
  );
  const roleAssignments = await observe(
    "MEMBERSHIP_OBSERVATION",
    () => sources.membership.listRoleAssignmentsForProject(manifest.project.id),
  );
  const protectedTransfers = await observe(
    "MEMBERSHIP_OBSERVATION",
    () => sources.membership.listProtectedRoleTransfers(manifest.project.id),
  );
  validateProjectWideRoleAssignmentLinks(
    manifest.project.id,
    memberships,
    roleAssignments,
  );

  return {
    authAccounts,
    persons,
    cadenceUsers,
    authenticationIdentities: authenticationIdentities.map(
      identityToObserved,
    ),
    projects: project ? [projectToObserved(project)] : [],
    projectHealth: health ? [healthToObserved(health)] : [],
    memberships: memberships.map(membershipToObserved),
    roleAssignments: roleAssignments.map(roleAssignmentToObserved),
    protectedTransfers: protectedTransfers.map(transferToObserved),
  };
}


function validateProjectWideRoleAssignmentLinks(
  projectId: string,
  memberships: readonly ProjectMembership[],
  roleAssignments: readonly ProjectRoleAssignment[],
): void {
  const membershipIds = new Set(
    memberships
      .filter((membership) => membership.projectId === projectId)
      .map((membership) => membership.id),
  );
  for (const assignment of roleAssignments) {
    if (
      assignment.projectId !== projectId ||
      !membershipIds.has(assignment.membershipId)
    ) {
      throw new ControlledPilotPreflightError(
        "MEMBERSHIP_OBSERVATION",
        "Project-wide role assignment cannot be mapped to an observed membership.",
        { runCorrelationId: "pending" },
      );
    }
  }
}


function validateObservedPilotState(
  observed: ObservedPilotState,
): void {
  for (const project of observed.projects) {
    if (
      !Number.isInteger(project.progressPercent) ||
      !Number.isFinite(project.progressPercent) ||
      project.progressPercent < 0 ||
      project.progressPercent > 100
    ) {
      throw new ControlledPilotPreflightError(
        "PROJECT_OBSERVATION",
        "Observed Project state is malformed.",
        { runCorrelationId: "pending" },
      );
    }
  }

  for (const health of observed.projectHealth) {
    if (!Array.isArray(health.reasons) || !health.source.trim()) {
      throw new ControlledPilotPreflightError(
        "PROJECT_HEALTH_OBSERVATION",
        "Observed Project Health state is malformed.",
        { runCorrelationId: "pending" },
      );
    }
  }

  for (const membership of observed.memberships) {
    if (
      !membership.id.trim() ||
      !membership.projectId.trim() ||
      !membership.personId.trim() ||
      !membership.effectiveFrom.trim()
    ) {
      throw new ControlledPilotPreflightError(
        "MEMBERSHIP_OBSERVATION",
        "Observed membership state is malformed.",
        { runCorrelationId: "pending" },
      );
    }
  }
}


async function observe<T>(
  category: Exclude<ControlledPilotPreflightErrorCategory, "INPUT" | "TARGET" | "PREFLIGHT_CONFLICT">,
  read: () => Promise<T>,
): Promise<T> {
  try {
    const result = await read();
    if (result === undefined) {
      throw new Error("Observation returned undefined.");
    }
    return result;
  } catch (error) {
    throw new ControlledPilotPreflightError(
      category,
      "Read-only observation failed.",
      { runCorrelationId: "pending" },
    );
  }
}


function observationCategory(
  error: unknown,
): ControlledPilotPreflightErrorCategory {
  if (error instanceof ControlledPilotPreflightError) {
    return error.category;
  }
  return "IDENTITY_OBSERVATION";
}


function cadenceUserToObserved(
  user: PilotCadenceUserRecord,
): ObservedCadenceUser {
  return {
    id: user.id,
    authUserId: user.authUserId,
    personId: user.personId,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    identityProvider: user.identityProvider,
  };
}


function identityToObserved(
  identity: AuthenticationIdentity,
): ObservedAuthenticationIdentity {
  return {
    id: identity.id,
    authUserId: identity.providerSubjectId,
    personId: identity.personId,
    provider: identity.provider,
    providerSubjectId: identity.providerSubjectId,
    loginIdentifier: identity.loginIdentifier,
    status: identity.status.toLowerCase() as "active" | "disabled",
    validFrom: identity.validFrom,
    validTo: identity.validTo,
  };
}


function projectToObserved(
  project: PilotProjectRecord,
): ObservedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    goal: project.goal,
    lifecycleStatus: project.lifecycleStatus,
    progressPercent: project.progressPercent,
    ownerUserId: project.ownerUserId,
    startDate: project.startDate,
    targetDate: project.targetDate,
  };
}


function healthToObserved(
  health: PilotProjectHealthRecord,
): ObservedProjectHealth {
  return {
    projectId: health.projectId,
    status: health.healthStatus,
    reasons: health.reasons,
    source: health.source,
    changedBy: health.changedBy,
  };
}


function membershipToObserved(
  membership: ProjectMembership,
): ObservedMembership {
  return {
    id: membership.id,
    projectId: membership.projectId,
    personId: membership.personId,
    effectiveFrom: membership.effectiveFrom,
    effectiveTo: membership.effectiveTo,
    status: membership.status,
    grantedByPersonId: membership.grantedBy,
    createdAt: membership.createdAt,
  };
}


function roleAssignmentToObserved(
  assignment: ProjectRoleAssignment,
): ObservedRoleAssignment {
  return {
    id: assignment.id,
    projectId: assignment.projectId,
    membershipId: assignment.membershipId,
    role: assignment.role,
    effectiveFrom: assignment.effectiveFrom,
    effectiveTo: assignment.effectiveTo,
    assignedBy: assignment.assignedBy,
    changeReason: assignment.changeReason,
    createdAt: assignment.createdAt,
  };
}


function transferToObserved(
  transfer: ProjectRoleTransferRecord,
): ObservedProtectedTransfer {
  return {
    id: transfer.id,
    projectId: transfer.projectId,
    role: transfer.role,
    outgoingAssignmentId: transfer.outgoingAssignmentId,
    incomingAssignmentId: transfer.incomingAssignmentId,
    authorisedByPersonId: transfer.authorisedByPersonId,
    reason: transfer.reason,
    correlationId: transfer.correlationId,
    effectiveAt: transfer.effectiveAt,
    createdAt: transfer.createdAt,
  };
}


function appendIdentities(
  target: AuthenticationIdentity[],
  values: readonly AuthenticationIdentity[],
): void {
  for (const value of values) {
    appendById(target, value);
  }
}


function appendById<T extends { id: string }>(
  target: T[],
  value: T,
): void {
  const exact = target.some(
    (existing) => existing.id === value.id &&
      JSON.stringify(existing) === JSON.stringify(value),
  );
  if (!exact) {
    target.push(value);
  }
}


function establishRunCorrelationId(
  value: string | undefined,
): string {
  if (value !== undefined) {
    if (!value.trim()) {
      throw new ControlledPilotPreflightError(
        "INPUT",
        "runCorrelationId must not be blank.",
        { runCorrelationId: "invalid" },
      );
    }
    return value;
  }
  return randomUUID();
}


function readManifestId(input: unknown): string | undefined {
  if (
    typeof input === "object" &&
    input !== null &&
    "manifestId" in input &&
    typeof input.manifestId === "string"
  ) {
    return input.manifestId;
  }
  return undefined;
}


function controlledError(
  category: ControlledPilotPreflightErrorCategory,
  message: string,
  runCorrelationId: string,
  manifestId: string | undefined,
  manifestHash: string | undefined,
  cause: unknown,
): ControlledPilotPreflightError {
  // The cause is deliberately not attached: provider/database errors may
  // contain credentials, SQL, or unauthorized business data.
  void cause;
  return new ControlledPilotPreflightError(
    category,
    message,
    { runCorrelationId, manifestId, manifestHash },
  );
}


function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    typeof value === "object" &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
