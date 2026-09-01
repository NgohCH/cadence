import {
  validateCadenceEnvironmentSafety,
} from "../src/bootstrap/environment-safety";
import {
  computeManifestHash,
  type PilotEnvironment,
  type PilotUserIntent,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import {
  isOrdinaryProjectRole,
  type ProjectRole,
} from "../src/modules/project-membership/project-role.types";


export interface ObservedAuthAccount {
  id: string;
  provider: string;
  providerSubjectId: string;
  loginIdentifier: string;
  status: "active" | "disabled";
}


export interface ObservedPerson {
  id: string;
  displayName: string;
}


export interface ObservedCadenceUser {
  id: string;
  authUserId: string | null;
  personId: string;
  username: string;
  displayName: string;
  email: string;
  status: "active" | "disabled";
  identityProvider: string;
}


export interface ObservedAuthenticationIdentity {
  id: string;
  authUserId: string;
  personId: string;
  provider: string;
  providerSubjectId: string;
  loginIdentifier: string;
  status: "active" | "disabled";
  validFrom: string;
  validTo: string | null;
}


export interface ObservedProject {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  lifecycleStatus: ValidatedPilotManifest["project"]["lifecycleStatus"];
  ownerUserId: string | null;
  startDate: string | null;
  targetDate: string | null;
}


export interface ObservedProjectHealth {
  projectId: string;
  status: ValidatedPilotManifest["project"]["health"]["status"];
  reasons: readonly string[];
  source: string;
  changedBy: string | null;
}


export interface ObservedMembership {
  id: string;
  projectId: string;
  personId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "ACTIVE" | "ENDED";
  grantedByPersonId: string | null;
  createdAt: string;
  readonly legacyFields?: {
    userId: string | null;
    roleId: string | null;
    joinedAt: string | null;
    status: string | null;
    createdBy: string | null;
  };
}


export interface ObservedRoleAssignment {
  id: string;
  projectId: string;
  membershipId: string;
  role: ProjectRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}


export interface ObservedProtectedTransfer {
  id: string;
  projectId: string;
  role: Extract<
    ProjectRole,
    "PROJECT_OWNER" | "PROJECT_MANAGER" | "PROJECT_SPONSOR"
  >;
  outgoingAssignmentId: string | null;
  incomingAssignmentId: string;
  authorisedByPersonId: string;
  reason: string;
  correlationId: string;
  effectiveAt: string;
  createdAt: string;
}


export interface ObservedPilotState {
  readonly authAccounts: readonly ObservedAuthAccount[];
  readonly persons: readonly ObservedPerson[];
  readonly cadenceUsers: readonly ObservedCadenceUser[];
  readonly authenticationIdentities: readonly ObservedAuthenticationIdentity[];
  readonly projects: readonly ObservedProject[];
  readonly projectHealth: readonly ObservedProjectHealth[];
  readonly memberships: readonly ObservedMembership[];
  readonly roleAssignments: readonly ObservedRoleAssignment[];
  readonly protectedTransfers: readonly ObservedProtectedTransfer[];
}


export interface PilotRuntimeTarget {
  cadenceEnv: string | undefined;
  supabaseUrl: string | undefined;
  supabaseProjectRef: string | undefined;
  safeTargetMarker: string;
}


export interface PilotPreflightInput {
  readonly manifest: ValidatedPilotManifest;
  readonly runtimeTarget: PilotRuntimeTarget;
  readonly observed: ObservedPilotState;
  readonly runCorrelationId: string;
}


export type PilotPlanOperationKind =
  | "CREATE_PERSON"
  | "CREATE_CADENCE_USER"
  | "CREATE_AUTH_IDENTITY"
  | "CREATE_PROJECT"
  | "CREATE_PROJECT_HEALTH"
  | "ADD_PROJECT_MEMBER"
  | "CHANGE_ORDINARY_ROLE"
  | "APPOINT_PROTECTED_ROLE"
  | "REUSE";


export interface PilotPlanOperation {
  readonly kind: PilotPlanOperationKind;
  readonly resourceKey: string;
  readonly manifestKey?: string;
  readonly id?: string;
  readonly role?: ProjectRole;
  readonly reason?: string;
}


export interface PilotPreflightPlan {
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly target: {
    readonly environment: PilotEnvironment;
    readonly projectId: string;
    readonly safeTargetMarker: string;
  };
  readonly operatorPersonId: string;
  readonly runCorrelationId: string;
  readonly operations: readonly PilotPlanOperation[];
}


export type PilotPreflightErrorCategory =
  | "TARGET"
  | "IDENTITY"
  | "PROJECT"
  | "MEMBERSHIP"
  | "ROLE"
  | "PROTECTED_ROLE";


export class PilotPreflightError extends Error {
  readonly category: PilotPreflightErrorCategory;

  constructor(
    category: PilotPreflightErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = "PilotPreflightError";
    this.category = category;
  }
}


const PROTECTED_ROLES = [
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_SPONSOR",
] as const;


export function buildPilotPreflightPlan(
  input: PilotPreflightInput,
): PilotPreflightPlan {
  validateExecutionInput(input);
  validateTarget(input);

  const manifest = input.manifest;
  const operations: PilotPlanOperation[] = [];
  const project = planProject(manifest, input.observed, operations);
  const operator = requirePerson(
    input.observed,
    manifest.operator.personId,
    manifest.operator.displayName,
    "operator",
  );

  for (const pilotUser of manifest.users) {
    planUser(
      manifest,
      pilotUser,
      input.observed,
      operator.id,
      project.createdOrExisting,
      operations,
    );
  }

  const plan: PilotPreflightPlan = {
    manifestId: manifest.manifestId,
    manifestHash: computeManifestHash(manifest),
    target: {
      environment: manifest.target.environment,
      projectId: manifest.project.id,
      safeTargetMarker: manifest.target.safeTargetMarker,
    },
    operatorPersonId: operator.id,
    runCorrelationId: input.runCorrelationId,
    operations,
  };
  return deepFreeze(plan);
}


function validateExecutionInput(input: PilotPreflightInput): void {
  if (!input.runCorrelationId.trim()) {
    throw preflightError(
      "TARGET",
      "runCorrelationId must be supplied for each execution.",
    );
  }
}


function validateTarget(input: PilotPreflightInput): void {
  let safety;
  try {
    safety = validateCadenceEnvironmentSafety({
      cadenceEnv: input.runtimeTarget.cadenceEnv,
      supabaseUrl: input.runtimeTarget.supabaseUrl,
      supabaseProjectRef: input.runtimeTarget.supabaseProjectRef,
    });
  } catch (error) {
    throw preflightError(
      "TARGET",
      error instanceof Error ? error.message : "Runtime target is unsafe.",
    );
  }

  const manifestTarget = input.manifest.target;
  if (
    safety.cadenceEnv !== manifestTarget.environment ||
    safety.supabaseProjectRef !== manifestTarget.supabaseProjectRef
  ) {
    throw preflightError(
      "TARGET",
      "Runtime target does not match the manifest environment declaration.",
    );
  }
  if (
    input.runtimeTarget.safeTargetMarker !==
    manifestTarget.safeTargetMarker
  ) {
    throw preflightError(
      "TARGET",
      "Runtime safeTargetMarker does not match the manifest.",
    );
  }
}


function planProject(
  manifest: ValidatedPilotManifest,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): { createdOrExisting: ObservedProject } {
  const intended = manifest.project;
  const matches = observed.projects.filter(
    (project) => project.id === intended.id,
  );
  if (matches.length > 1) {
    throw preflightError("PROJECT", "Multiple existing projects share the intended project ID.");
  }

  const existing = matches[0];
  if (existing) {
    if (
      existing.name !== intended.name ||
      existing.description !== intended.description ||
      existing.goal !== intended.goal ||
      existing.lifecycleStatus !== intended.lifecycleStatus ||
      existing.ownerUserId !== intended.ownerUserId ||
      existing.startDate !== intended.startDate ||
      existing.targetDate !== intended.targetDate
    ) {
      throw preflightError(
        "PROJECT",
        "Existing project has incompatible project fields or owner_user_id projection.",
      );
    }
    addReuse(operations, `project:${existing.id}`, undefined, existing.id);
  } else {
    operations.push({
      kind: "CREATE_PROJECT",
      resourceKey: `project:${intended.id}`,
      id: intended.id,
    });
  }

  const healthMatches = observed.projectHealth.filter(
    (health) => health.projectId === intended.id,
  );
  if (healthMatches.length > 1) {
    throw preflightError("PROJECT", "Multiple Project Health rows exist for the intended project.");
  }
  const existingHealth = healthMatches[0];
  if (!existing && existingHealth) {
    throw preflightError("PROJECT", "Orphan Project Health exists without its intended project.");
  }
  if (!existingHealth) {
    operations.push({
      kind: "CREATE_PROJECT_HEALTH",
      resourceKey: `project-health:${intended.id}`,
      id: intended.id,
    });
  } else if (
    existingHealth.status !== intended.health.status ||
    !sameStringArray(existingHealth.reasons, intended.health.reasons) ||
    existingHealth.source !== intended.health.source ||
    existingHealth.changedBy !== intended.health.changedBy
  ) {
    throw preflightError("PROJECT", "Existing Project Health is incompatible with the manifest.");
  } else {
    addReuse(operations, `project-health:${intended.id}`, undefined, intended.id);
  }

  return {
    createdOrExisting: existing ?? {
      id: intended.id,
      name: intended.name,
      description: intended.description,
      goal: intended.goal,
      lifecycleStatus: intended.lifecycleStatus,
      ownerUserId: intended.ownerUserId,
      startDate: intended.startDate,
      targetDate: intended.targetDate,
    },
  };
}


function planUser(
  manifest: ValidatedPilotManifest,
  intended: PilotUserIntent,
  observed: ObservedPilotState,
  operatorPersonId: string,
  project: ObservedProject,
  operations: PilotPlanOperation[],
): void {
  const person = planPerson(intended, observed, operations);
  const auth = planAuthentication(intended, person.id, observed, operations);
  planCadenceUser(intended, person.id, auth.authUserId, observed, operations);
  const membership = planMembership(
    manifest,
    intended,
    person.id,
    observed,
    operations,
  );
  planRole(
    manifest,
    intended,
    membership.id,
    project.id,
    operatorPersonId,
    observed,
    operations,
  );
}


function planPerson(
  intended: PilotUserIntent,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): ObservedPerson {
  const existing = observed.persons.filter(
    (person) => person.id === intended.person.id,
  );
  if (existing.length > 1) {
    throw preflightError("IDENTITY", `Multiple Persons exist for ${intended.key}.`);
  }
  const person = existing[0];
  if (!person) {
    if (intended.person.kind !== "new") {
      throw preflightError("IDENTITY", `Existing Person is missing for ${intended.key}.`);
    }
    operations.push({
      kind: "CREATE_PERSON",
      resourceKey: `person:${intended.person.id}`,
      manifestKey: intended.key,
      id: intended.person.id,
    });
    return {
      id: intended.person.id,
      displayName: intended.person.displayName ?? intended.displayName,
    };
  }
  const expectedName = intended.person.displayName ?? intended.displayName;
  if (person.displayName !== expectedName) {
    throw preflightError("IDENTITY", `Existing Person has incompatible identity for ${intended.key}.`);
  }
  addReuse(operations, `person:${person.id}`, intended.key, person.id);
  return person;
}


function planAuthentication(
  intended: PilotUserIntent,
  personId: string,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): { authUserId: string } {
  const authIntent = intended.authentication;
  const accountMatches = observed.authAccounts.filter(
    (account) =>
      account.loginIdentifier.toLowerCase() ===
      authIntent.loginIdentifier.toLowerCase(),
  );
  if (accountMatches.length > 1) {
    throw preflightError("IDENTITY", `Multiple authentication accounts use ${authIntent.loginIdentifier}.`);
  }
  const expectedAccountSubject =
    authIntent.providerSubjectId ?? accountMatches[0]?.providerSubjectId;
  if (
    accountMatches[0] &&
    observed.authAccounts.filter(
      (account) => account.id === accountMatches[0].id,
    ).length > 1
  ) {
    throw preflightError("IDENTITY", `Multiple conflicting authentication accounts exist for ${intended.key}.`);
  }
  if (
    expectedAccountSubject &&
    observed.authAccounts.filter(
      (account) =>
        account.provider === authIntent.provider &&
        account.providerSubjectId === expectedAccountSubject,
    ).length > 1
  ) {
    throw preflightError("IDENTITY", `Multiple conflicting authentication accounts exist for ${intended.key}.`);
  }

  const identityMatches = observed.authenticationIdentities.filter(
    (identity) => identity.id === authIntent.identityId ||
      (identity.provider === authIntent.provider &&
        identity.loginIdentifier.toLowerCase() ===
          authIntent.loginIdentifier.toLowerCase()),
  );
  if (
    authIntent.identityId &&
    observed.authenticationIdentities.some(
      (identity) =>
        identity.id !== authIntent.identityId &&
        identity.provider === authIntent.provider &&
        identity.loginIdentifier.toLowerCase() ===
          authIntent.loginIdentifier.toLowerCase(),
    )
  ) {
    throw preflightError("IDENTITY", `Authentication identity ID conflicts for ${intended.key}.`);
  }
  if (identityMatches.length > 1) {
    throw preflightError("IDENTITY", `Multiple conflicting authentication identities exist for ${intended.key}.`);
  }

  const activeForPerson = observed.authenticationIdentities.filter(
    (identity) => identity.personId === personId && identity.status === "active",
  );
  if (activeForPerson.length > 1) {
    throw preflightError("IDENTITY", `Multiple conflicting active authentication identities exist for ${intended.key}.`);
  }

  const account = accountMatches[0];
  const identity = identityMatches[0];
  const expectedSubject = authIntent.providerSubjectId;
  const identityAccount = identity
    ? observed.authAccounts.find((candidate) => candidate.id === identity.authUserId)
    : undefined;
  if (identity && !identityAccount) {
    throw preflightError("IDENTITY", `Authentication identity has no matching Auth account for ${intended.key}.`);
  }
  if (
    identityAccount &&
    (identityAccount.provider !== authIntent.provider ||
      identityAccount.loginIdentifier.toLowerCase() !==
        authIntent.loginIdentifier.toLowerCase() ||
      (expectedSubject !== undefined &&
        identityAccount.providerSubjectId !== expectedSubject) ||
      identityAccount.status !== "active")
  ) {
    throw preflightError("IDENTITY", `Auth account conflicts with the authentication identity for ${intended.key}.`);
  }
  if (account && account.status !== "active") {
    throw preflightError("IDENTITY", `Authentication account is not active for ${intended.key}.`);
  }
  if (account && account.provider !== authIntent.provider) {
    throw preflightError("IDENTITY", `Authentication provider conflicts for ${intended.key}.`);
  }
  if (account && expectedSubject && account.providerSubjectId !== expectedSubject) {
    throw preflightError("IDENTITY", `Authentication provider subject conflicts for ${intended.key}.`);
  }
  if (identity) {
    if (
      identity.personId !== personId ||
      identity.provider !== authIntent.provider ||
      identity.loginIdentifier.toLowerCase() !== authIntent.loginIdentifier.toLowerCase() ||
      (expectedSubject !== undefined && identity.providerSubjectId !== expectedSubject) ||
      identity.status !== "active"
    ) {
      throw preflightError("IDENTITY", `Authentication identity maps to the wrong Person or subject for ${intended.key}.`);
    }
    if (account && identity.authUserId !== account.id) {
      throw preflightError("IDENTITY", `Authentication identity maps to the wrong Auth user for ${intended.key}.`);
    }
    addReuse(operations, `authentication-identity:${identity.id}`, intended.key, identity.id);
    return { authUserId: identity.authUserId };
  }
  if (account) {
    const linked = observed.authenticationIdentities.filter(
      (candidate) => candidate.authUserId === account.id,
    );
    if (linked.length > 0 && !linked.some((candidate) => candidate.personId === personId)) {
      throw preflightError("IDENTITY", `Auth/provider subject is mapped to the wrong Person for ${intended.key}.`);
    }
    operations.push({
      kind: "CREATE_AUTH_IDENTITY",
      resourceKey: `authentication-identity:${authIntent.identityId ?? authIntent.loginIdentifier}`,
      manifestKey: intended.key,
      id: authIntent.identityId,
    });
    return { authUserId: account.id };
  }
  operations.push({
    kind: "CREATE_AUTH_IDENTITY",
    resourceKey: `authentication-identity:${authIntent.identityId ?? authIntent.loginIdentifier}`,
    manifestKey: intended.key,
    id: authIntent.identityId,
  });
  return {
    authUserId: authIntent.providerSubjectId ?? `planned-auth:${intended.key}`,
  };
}


function planCadenceUser(
  intended: PilotUserIntent,
  personId: string,
  authUserId: string,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): void {
  const matches = observed.cadenceUsers.filter(
    (user) => user.id === intended.cadenceUser.id,
  );
  if (matches.length > 1) {
    throw preflightError("IDENTITY", `Multiple Cadence Users exist for ${intended.key}.`);
  }
  const existing = matches[0];
  if (!existing) {
    operations.push({
      kind: "CREATE_CADENCE_USER",
      resourceKey: `cadence-user:${intended.cadenceUser.id}`,
      manifestKey: intended.key,
      id: intended.cadenceUser.id,
    });
    return;
  }
  if (
    existing.personId !== personId ||
    existing.authUserId !== authUserId ||
    existing.username !== intended.cadenceUser.username ||
    existing.displayName !== intended.cadenceUser.displayName ||
    existing.email !== intended.cadenceUser.email ||
    existing.status !== "active" ||
    existing.identityProvider !== intended.cadenceUser.identityProvider
  ) {
    throw preflightError("IDENTITY", `Cadence User maps to the wrong Person or Auth identity for ${intended.key}.`);
  }
  addReuse(operations, `cadence-user:${existing.id}`, intended.key, existing.id);
}


function planMembership(
  manifest: ValidatedPilotManifest,
  intended: PilotUserIntent,
  personId: string,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): ObservedMembership {
  const membershipIntent = intended.membership;
  const matches = observed.memberships.filter(
    (membership) => membership.id === membershipIntent.id,
  );
  if (matches.length > 1) {
    throw preflightError("MEMBERSHIP", `Multiple memberships exist for ${intended.key}.`);
  }
  const existing = matches[0];
  const overlaps = observed.memberships.filter(
    (membership) =>
      membership.projectId === manifest.project.id &&
      membership.personId === personId &&
      membership.id !== membershipIntent.id &&
      membership.status === "ACTIVE" &&
      periodsOverlap(membership.effectiveFrom, membership.effectiveTo, membershipIntent.effectiveFrom, membershipIntent.effectiveTo),
  );
  if (overlaps.length > 0) {
    throw preflightError("MEMBERSHIP", `Overlapping contradictory membership exists for ${intended.key}.`);
  }

  if (!existing) {
    operations.push({
      kind: "ADD_PROJECT_MEMBER",
      resourceKey: `membership:${membershipIntent.id}`,
      manifestKey: intended.key,
      id: membershipIntent.id,
    });
    return {
      id: membershipIntent.id,
      projectId: manifest.project.id,
      personId,
      effectiveFrom: membershipIntent.effectiveFrom,
      effectiveTo: membershipIntent.effectiveTo,
      status: "ACTIVE",
      grantedByPersonId: membershipIntent.grantedByPersonId,
      createdAt: membershipIntent.effectiveFrom,
    };
  }
  if (
    existing.projectId !== manifest.project.id ||
    existing.personId !== personId
  ) {
    throw preflightError("MEMBERSHIP", `Membership maps to the wrong Person or project for ${intended.key}.`);
  }
  if (
    existing.status !== "ACTIVE" ||
    existing.effectiveFrom !== membershipIntent.effectiveFrom ||
    existing.effectiveTo !== membershipIntent.effectiveTo ||
    existing.grantedByPersonId !== membershipIntent.grantedByPersonId
  ) {
    throw preflightError("MEMBERSHIP", `Membership has an incompatible period, lifecycle, or grantor/provenance for ${intended.key}.`);
  }
  addReuse(operations, `membership:${existing.id}`, intended.key, existing.id);
  return existing;
}


function planRole(
  manifest: ValidatedPilotManifest,
  intended: PilotUserIntent,
  membershipId: string,
  projectId: string,
  operatorPersonId: string,
  observed: ObservedPilotState,
  operations: PilotPlanOperation[],
): void {
  const assignments = observed.roleAssignments.filter(
    (assignment) =>
      assignment.projectId === projectId &&
      assignment.membershipId === membershipId,
  );
  const active = assignments.filter(
    (assignment) =>
      isEffectiveAt(
        assignment.effectiveFrom,
        assignment.effectiveTo,
        intended.membership.effectiveFrom,
      ),
  );
  if (isOrdinaryProjectRole(intended.role)) {
    const ordinaryActive = active.filter((assignment) => isOrdinaryProjectRole(assignment.role));
    if (ordinaryActive.length > 1) {
      throw preflightError("ROLE", `Contradictory overlapping ordinary role exists for ${intended.key}.`);
    }
    const exact = assignments.find(
      (assignment) =>
        assignment.id === intended.roleAssignmentId &&
        assignment.role === intended.role &&
        assignment.effectiveFrom === intended.membership.effectiveFrom &&
        assignment.effectiveTo === intended.membership.effectiveTo,
    );
    if (exact) {
      addReuse(operations, `role-assignment:${exact.id}`, intended.key, exact.id, intended.role);
      return;
    }
    if (intended.role === "PROJECT_MEMBER" && assignments.length === 0) {
      if (!observed.memberships.some((membership) => membership.id === membershipId)) {
        return;
      }
      throw preflightError("ROLE", `Initial ordinary role assignment is missing for ${intended.key}.`);
    }
    if (active.length > 0 && active[0].role !== intended.role) {
      operations.push({
        kind: "CHANGE_ORDINARY_ROLE",
        resourceKey: `role-assignment:${intended.roleAssignmentId}`,
        manifestKey: intended.key,
        id: intended.roleAssignmentId,
        role: intended.role,
      });
      return;
    }
    operations.push({
      kind: "CHANGE_ORDINARY_ROLE",
      resourceKey: `role-assignment:${intended.roleAssignmentId}`,
      manifestKey: intended.key,
      id: intended.roleAssignmentId,
      role: intended.role,
    });
    return;
  }

  planProtectedRole(
    intended,
    projectId,
    operatorPersonId,
    observed,
    active,
    operations,
  );
}


function planProtectedRole(
  intended: PilotUserIntent,
  projectId: string,
  operatorPersonId: string,
  observed: ObservedPilotState,
  activeForMembership: readonly ObservedRoleAssignment[],
  operations: PilotPlanOperation[],
): void {
  const role = intended.role as Extract<
    ProjectRole,
    "PROJECT_OWNER" | "PROJECT_MANAGER" | "PROJECT_SPONSOR"
  >;
  const projectAssignments = observed.roleAssignments.filter(
    (assignment) => assignment.projectId === projectId && assignment.role === role,
  );
  const effective = projectAssignments.filter(
    (assignment) => isEffectiveAt(
      assignment.effectiveFrom,
      assignment.effectiveTo,
      intended.membership.effectiveFrom,
    ),
  );
  if (effective.length > 1) {
    throw preflightError("PROTECTED_ROLE", `Multiple effective holders exist for ${role}.`);
  }
  const ledger = observed.protectedTransfers.filter(
    (transfer) => transfer.projectId === projectId && transfer.role === role,
  );
  if (effective.length === 0) {
    if (projectAssignments.length > 0 || ledger.length > 0) {
      throw preflightError("PROTECTED_ROLE", `Protected ${role} history is contradictory.`);
    }
    operations.push({
      kind: "APPOINT_PROTECTED_ROLE",
      resourceKey: `protected-role:${role}`,
      manifestKey: intended.key,
      id: intended.roleAssignmentId,
      role,
      reason: intended.protectedRoleReason,
    });
    return;
  }

  const holder = effective[0];
  if (holder.membershipId !== intended.membership.id) {
    throw preflightError("PROTECTED_ROLE", `Protected ${role} has a different effective holder; bootstrap cannot transfer it.`);
  }
  if (holder.id !== intended.roleAssignmentId) {
    throw preflightError("PROTECTED_ROLE", `Protected ${role} has an incompatible assignment.`);
  }
  const matchingLedger = ledger.filter(
    (transfer) =>
      transfer.id === intended.protectedTransferId &&
      transfer.incomingAssignmentId === holder.id &&
      transfer.outgoingAssignmentId === null &&
      transfer.authorisedByPersonId === operatorPersonId &&
      transfer.reason === intended.protectedRoleReason &&
      transfer.effectiveAt === intended.membership.effectiveFrom,
  );
  if (matchingLedger.length !== 1) {
    throw preflightError("PROTECTED_ROLE", `Protected ${role} has a missing or mismatched immutable transfer ledger.`);
  }
  if (activeForMembership.length !== 1 || activeForMembership[0].role !== role) {
    throw preflightError("PROTECTED_ROLE", `Protected ${role} assignment is not an exact compatible active assignment.`);
  }
  addReuse(operations, `protected-role:${role}`, intended.key, holder.id, role);
}


function requirePerson(
  observed: ObservedPilotState,
  personId: string,
  displayName: string,
  label: string,
): ObservedPerson {
  const person = observed.persons.find((candidate) => candidate.id === personId);
  if (!person) {
    throw preflightError("IDENTITY", `Named ${label} Person is missing: ${personId}.`);
  }
  if (person.displayName !== displayName) {
    throw preflightError("IDENTITY", `Named ${label} Person has incompatible identity.`);
  }
  return person;
}


function addReuse(
  operations: PilotPlanOperation[],
  resourceKey: string,
  manifestKey?: string,
  id?: string,
  role?: ProjectRole,
): void {
  operations.push({
    kind: "REUSE",
    resourceKey,
    ...(manifestKey ? { manifestKey } : {}),
    ...(id ? { id } : {}),
    ...(role ? { role } : {}),
  });
}


function periodsOverlap(
  firstFrom: string,
  firstTo: string | null,
  secondFrom: string,
  secondTo: string | null,
): boolean {
  const firstEnd = firstTo ? Date.parse(firstTo) : Number.POSITIVE_INFINITY;
  const secondEnd = secondTo ? Date.parse(secondTo) : Number.POSITIVE_INFINITY;
  return Date.parse(firstFrom) < secondEnd && Date.parse(secondFrom) < firstEnd;
}


function isEffectiveAt(
  effectiveFrom: string,
  effectiveTo: string | null,
  instant: string,
): boolean {
  const at = Date.parse(instant);
  return Date.parse(effectiveFrom) <= at &&
    (effectiveTo === null || at < Date.parse(effectiveTo));
}


function sameStringArray(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}


function preflightError(
  category: PilotPreflightErrorCategory,
  message: string,
): PilotPreflightError {
  return new PilotPreflightError(category, message);
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
