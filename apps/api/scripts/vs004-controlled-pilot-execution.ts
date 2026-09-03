import type {
  PilotIdentityPreparationIntent,
  PilotIdentityPreparationResult,
  PilotIdentityResourceActions,
  PilotPreparationResourceEvidence,
} from "../src/modules/identity/pilot-preparation.types";
import type { PilotPreparationService } from "../src/modules/identity/pilot-preparation.service";
import type {
  PilotProjectPreparationIntent,
  PilotProjectPreparationResult,
} from "../src/modules/projects/pilot-preparation.types";
import type { ProjectsPilotPreparationService } from "../src/modules/projects/pilot-preparation.service";
import type {
  PilotProjectHealthPreparationIntent,
  PilotProjectHealthPreparationResult,
} from "../src/modules/project-health/pilot-preparation.types";
import type { ProjectHealthPilotPreparationService } from "../src/modules/project-health/pilot-preparation.service";
import type {
  PilotMembershipPreparationRequest,
  PilotOrdinaryRolePreparationRequest,
  PilotPreparationOutcome,
  PilotProtectedRolePreparationRequest,
} from "../src/modules/project-membership/pilot-preparation.types";
import type { ProjectMembershipPilotPreparationService } from "../src/modules/project-membership/pilot-preparation.service";
import {
  computeManifestHash,
  validatePilotManifest,
  type PilotUserIntent,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import {
  validatePilotRuntimeTarget,
  type PilotPlanOperation,
  type PilotPlanOperationKind,
  type PilotPreflightPlan,
  type PilotRuntimeTarget,
} from "./vs004-preflight";
import type {
  PreparedPilotExecution,
} from "./vs004-controlled-pilot-preflight";


type IdentityPreparationService = Pick<
  PilotPreparationService,
  "preparePilotIdentity"
>;
type ProjectsPreparationService = Pick<
  ProjectsPilotPreparationService,
  "preparePilotProject"
>;
type ProjectHealthPreparationService = Pick<
  ProjectHealthPilotPreparationService,
  "preparePilotHealth"
>;
type MembershipPreparationService = Pick<
  ProjectMembershipPilotPreparationService,
  | "prepareMembership"
  | "prepareOrdinaryRoleAssignment"
  | "prepareProtectedRoleAppointment"
>;


export interface ControlledPilotExecutionServices {
  readonly identity: IdentityPreparationService;
  readonly projects: ProjectsPreparationService;
  readonly projectHealth: ProjectHealthPreparationService;
  readonly membership: MembershipPreparationService;
}


export interface ControlledPilotExecutionInput {
  prepared: PreparedPilotExecution;
  runtimeTarget: PilotRuntimeTarget;
  services: ControlledPilotExecutionServices;
}


export interface ControlledPilotExecutionOptions {
  now?: () => string;
}


export type PilotExecutionModule =
  | "Identity"
  | "Projects"
  | "Project Health"
  | "Project Membership";


export interface PilotExecutionOutcome {
  readonly resourceKey: string;
  readonly plannedOperation: PilotPlanOperationKind;
  readonly owningModule: PilotExecutionModule;
  readonly resourceId: string;
  readonly actualResult: "CREATED" | "REUSED";
  readonly operatorPersonId: string;
  readonly runCorrelationId: string;
}


export interface PilotExecutionResult {
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly runCorrelationId: string;
  readonly target: PreparedPilotExecution["target"];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcomes: readonly PilotExecutionOutcome[];
}


export type PilotExecutionErrorCategory =
  | "INPUT"
  | "TARGET"
  | "PREPARED_EXECUTION"
  | "UNSUPPORTED_OPERATION"
  | "STALE_PLAN"
  | "IDENTITY"
  | "PROJECT"
  | "PROJECT_HEALTH"
  | "MEMBERSHIP"
  | "ORDINARY_ROLE"
  | "PROTECTED_ROLE";


export class ControlledPilotExecutionError extends Error {
  readonly category: PilotExecutionErrorCategory;
  readonly manifestId: string | undefined;
  readonly manifestHash: string | undefined;
  readonly runCorrelationId: string;
  readonly failedOperation: Readonly<{
    resourceKey: string;
    kind: PilotPlanOperationKind | string;
  }> | undefined;
  readonly completedOutcomes: readonly PilotExecutionOutcome[];

  constructor(
    category: PilotExecutionErrorCategory,
    message: string,
    context: {
      manifestId?: string;
      manifestHash?: string;
      runCorrelationId: string;
      failedOperation?: {
        resourceKey: string;
        kind: PilotPlanOperationKind | string;
      };
      completedOutcomes?: readonly PilotExecutionOutcome[];
    },
  ) {
    super(message);
    this.name = "ControlledPilotExecutionError";
    this.category = category;
    this.manifestId = context.manifestId;
    this.manifestHash = context.manifestHash;
    this.runCorrelationId = context.runCorrelationId;
    this.failedOperation = context.failedOperation;
    this.completedOutcomes = context.completedOutcomes ?? [];
  }
}


type Phase =
  | "IDENTITY"
  | "PROJECT"
  | "PROJECT_HEALTH"
  | "MEMBERSHIP"
  | "ORDINARY_ROLE"
  | "PROTECTED_ROLE";


const PHASES: readonly Phase[] = [
  "IDENTITY",
  "PROJECT",
  "PROJECT_HEALTH",
  "MEMBERSHIP",
  "ORDINARY_ROLE",
  "PROTECTED_ROLE",
];


export async function executeControlledPilot(
  input: ControlledPilotExecutionInput,
  options: ControlledPilotExecutionOptions = {},
): Promise<PilotExecutionResult> {
  const runCorrelationId = input.prepared.runCorrelationId;
  const validated = validatePreparedExecution(input.prepared, input.runtimeTarget);
  const phases = validateAndGroupOperations(
    validated.manifest,
    validated.plan,
  );
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const outcomes: PilotExecutionOutcome[] = [];

  try {
    for (const phase of PHASES) {
      if (phase === "IDENTITY") {
        await executeIdentityPhase(
          phases.IDENTITY,
          validated.manifest,
          input.services.identity,
          validated.context,
          outcomes,
        );
      } else if (phase === "PROJECT") {
        await executeProjectPhase(
          phases.PROJECT,
          validated.manifest,
          input.services.projects,
          validated.context,
          outcomes,
        );
      } else if (phase === "PROJECT_HEALTH") {
        await executeProjectHealthPhase(
          phases.PROJECT_HEALTH,
          validated.manifest,
          input.services.projectHealth,
          validated.context,
          outcomes,
        );
      } else if (phase === "MEMBERSHIP") {
        await executeMembershipPhase(
          phases.MEMBERSHIP,
          validated.manifest,
          input.services.membership,
          validated.context,
          outcomes,
        );
      } else if (phase === "ORDINARY_ROLE") {
        await executeOrdinaryRolePhase(
          phases.ORDINARY_ROLE,
          validated.manifest,
          input.services.membership,
          validated.context,
          outcomes,
        );
      } else {
        await executeProtectedRolePhase(
          phases.PROTECTED_ROLE,
          validated.manifest,
          input.services.membership,
          validated.context,
          outcomes,
        );
      }
    }
  } catch (error) {
    if (error instanceof ControlledPilotExecutionError) {
      throw error;
    }
    throw executionError(
      "PREPARED_EXECUTION",
      "Controlled pilot execution stopped safely.",
      validated.context,
      undefined,
      outcomes,
    );
  }

  return deepFreeze({
    manifestId: validated.manifest.manifestId,
    manifestHash: validated.manifestHash,
    runCorrelationId,
    target: input.prepared.target,
    startedAt,
    completedAt: now(),
    outcomes,
  });
}


function validatePreparedExecution(
  prepared: PreparedPilotExecution,
  runtimeTarget: PilotRuntimeTarget,
): {
  manifest: ValidatedPilotManifest;
  manifestHash: string;
  plan: PilotPreflightPlan;
  context: { operatorPersonId: string; runCorrelationId: string };
} {
  const runCorrelationId = typeof prepared.runCorrelationId === "string"
    ? prepared.runCorrelationId
    : "invalid";
  let manifest: ValidatedPilotManifest;
  try {
    manifest = validatePilotManifest(prepared.validatedManifest);
  } catch {
    throw executionError("PREPARED_EXECUTION", "Prepared manifest is invalid.", {
      runCorrelationId,
    });
  }

  const manifestHash = computeManifestHash(manifest);
  if (
    prepared.manifestId !== manifest.manifestId ||
    prepared.manifestHash !== manifestHash ||
    prepared.operatorPersonId !== manifest.operator.personId ||
    !runCorrelationId.trim()
  ) {
    throw executionError("PREPARED_EXECUTION", "Prepared execution identity is inconsistent.", {
      manifestId: manifest.manifestId,
      manifestHash,
      runCorrelationId,
    });
  }

  try {
    validatePilotRuntimeTarget(manifest, runtimeTarget);
  } catch {
    throw executionError("TARGET", "Runtime target is no longer allowed.", {
      manifestId: manifest.manifestId,
      manifestHash,
      runCorrelationId,
    });
  }

  const preparedTarget = prepared.target;
  if (
    preparedTarget.environment !== manifest.target.environment ||
    preparedTarget.projectId !== manifest.project.id ||
    preparedTarget.safeTargetMarker !== manifest.target.safeTargetMarker ||
    preparedTarget.supabaseUrl !== runtimeTarget.supabaseUrl ||
    (preparedTarget.supabaseProjectRef ?? null) !== (runtimeTarget.supabaseProjectRef ?? null)
  ) {
    throw executionError("TARGET", "Prepared execution target binding is inconsistent.", {
      manifestId: manifest.manifestId,
      manifestHash,
      runCorrelationId,
    });
  }

  const plan = prepared.preflightPlan;
  if (
    plan.manifestId !== prepared.manifestId ||
    plan.manifestHash !== prepared.manifestHash ||
    plan.operatorPersonId !== prepared.operatorPersonId ||
    plan.runCorrelationId !== prepared.runCorrelationId ||
    plan.target.environment !== preparedTarget.environment ||
    plan.target.projectId !== preparedTarget.projectId ||
    plan.target.safeTargetMarker !== preparedTarget.safeTargetMarker
  ) {
    throw executionError("PREPARED_EXECUTION", "Prepared plan binding is inconsistent.", {
      manifestId: manifest.manifestId,
      manifestHash,
      runCorrelationId,
    });
  }

  return {
    manifest,
    manifestHash,
    plan,
    context: {
      operatorPersonId: prepared.operatorPersonId,
      runCorrelationId,
    },
  };
}


function validateAndGroupOperations(
  manifest: ValidatedPilotManifest,
  plan: PilotPreflightPlan,
): Record<Phase, PilotPlanOperation[]> {
  const phases: Record<Phase, PilotPlanOperation[]> = {
    IDENTITY: [],
    PROJECT: [],
    PROJECT_HEALTH: [],
    MEMBERSHIP: [],
    ORDINARY_ROLE: [],
    PROTECTED_ROLE: [],
  };
  const seen = new Set<string>();
  const userOperations = new Map<string, Set<string>>();

  if (!Array.isArray(plan.operations)) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation list is invalid.", {
      runCorrelationId: plan.runCorrelationId,
      manifestId: manifest.manifestId,
      manifestHash: plan.manifestHash,
    });
  }

  for (const operation of plan.operations) {
    validateOperation(manifest, operation, seen, userOperations);
    const phase = operationPhase(operation);
    phases[phase].push(operation);
  }

  const projectOperations = phases.PROJECT;
  const healthOperations = phases.PROJECT_HEALTH;
  if (projectOperations.length !== 1 || healthOperations.length !== 1) {
    throw executionError("PREPARED_EXECUTION", "Prepared Project dependency plan is incomplete.", {
      runCorrelationId: plan.runCorrelationId,
      manifestId: manifest.manifestId,
      manifestHash: plan.manifestHash,
    });
  }

  for (const user of manifest.users) {
    const operations = userOperations.get(user.key) ?? new Set<string>();
    for (const required of ["AUTH_ACCOUNT", "PERSON", "CADENCE_USER", "AUTHENTICATION_IDENTITY", "MEMBERSHIP"]) {
      if (!operations.has(required)) {
        throw executionError("PREPARED_EXECUTION", `Prepared dependency plan is missing ${required} for ${user.key}.`, {
          runCorrelationId: plan.runCorrelationId,
          manifestId: manifest.manifestId,
          manifestHash: plan.manifestHash,
        });
      }
    }
    if (isProtectedRole(user.role) && !operations.has("PROTECTED_ROLE")) {
      throw executionError("PREPARED_EXECUTION", `Prepared protected-role plan is missing for ${user.key}.`, {
        runCorrelationId: plan.runCorrelationId,
        manifestId: manifest.manifestId,
        manifestHash: plan.manifestHash,
      });
    }
    if (isReplacementRole(user.role) && !operations.has("ORDINARY_ROLE")) {
      throw executionError("PREPARED_EXECUTION", `Prepared ordinary-role plan is missing for ${user.key}.`, {
        runCorrelationId: plan.runCorrelationId,
        manifestId: manifest.manifestId,
        manifestHash: plan.manifestHash,
      });
    }
  }

  return phases;
}


function validateOperation(
  manifest: ValidatedPilotManifest,
  operation: PilotPlanOperation,
  seen: Set<string>,
  userOperations: Map<string, Set<string>>,
): void {
  if (typeof operation !== "object" || operation === null) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation is malformed.", {
      runCorrelationId: "validation",
    });
  }
  if (!isSupportedOperation(operation.kind)) {
    throw executionError("UNSUPPORTED_OPERATION", "Prepared operation is unsupported.", {
      runCorrelationId: "validation",
      failedOperation: {
        resourceKey: String(operation?.resourceKey ?? ""),
        kind: String(operation?.kind ?? ""),
      },
    });
  }
  if (typeof operation.resourceKey !== "string" || !operation.resourceKey.trim()) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation has no resource key.", {
      runCorrelationId: "validation",
    });
  }
  if (seen.has(operation.resourceKey)) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation list contains duplicate resources.", {
      runCorrelationId: "validation",
      failedOperation: { resourceKey: operation.resourceKey, kind: operation.kind },
    });
  }
  seen.add(operation.resourceKey);

  if (operation.kind === "CREATE_PROJECT" || operation.kind === "REUSE" && operation.resourceKey.startsWith("project:")) {
    if (
      operation.resourceKey !== `project:${manifest.project.id}` ||
      operation.id !== manifest.project.id ||
      operation.manifestKey !== undefined ||
      (operation.kind === "CREATE_PROJECT" && operation.progressPercent !== manifest.project.progressPercent)
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared Project operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    return;
  }
  if (operation.kind === "CREATE_PROJECT_HEALTH" || operation.kind === "REUSE" && operation.resourceKey.startsWith("project-health:")) {
    if (
      operation.resourceKey !== `project-health:${manifest.project.id}` ||
      operation.id !== manifest.project.id ||
      operation.manifestKey !== undefined
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared Project Health operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    return;
  }

  const user = operation.manifestKey
    ? manifest.users.find((candidate) => candidate.key === operation.manifestKey)
    : undefined;
  if (!user) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation references an unknown pilot user.", { runCorrelationId: "validation" });
  }
  const categories = userOperations.get(user.key) ?? new Set<string>();
  userOperations.set(user.key, categories);

  if (operation.kind === "CREATE_PERSON" || operation.kind === "REUSE" && operation.resourceKey.startsWith("person:")) {
    if (operation.resourceKey !== `person:${user.person.id}` || operation.id !== user.person.id) {
      throw executionError("PREPARED_EXECUTION", "Prepared Person operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("PERSON");
    return;
  }
  if (operation.kind === "CREATE_CADENCE_USER" || operation.kind === "REUSE" && operation.resourceKey.startsWith("cadence-user:")) {
    if (operation.resourceKey !== `cadence-user:${user.cadenceUser.id}` || operation.id !== user.cadenceUser.id) {
      throw executionError("PREPARED_EXECUTION", "Prepared Cadence User operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("CADENCE_USER");
    return;
  }
  if (operation.kind === "CREATE_AUTH_ACCOUNT" || operation.kind === "REUSE" && operation.resourceKey.startsWith("auth-account:")) {
    const expectedKey = `auth-account:${user.authentication.provider}:${user.authentication.providerSubjectId ?? user.authentication.loginIdentifier}`;
    if (
      operation.resourceKey !== expectedKey ||
      operation.kind === "CREATE_AUTH_ACCOUNT" && operation.id !== undefined ||
      operation.kind === "REUSE" && (typeof operation.id !== "string" || !operation.id.trim())
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared Auth-account operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("AUTH_ACCOUNT");
    return;
  }
  if (operation.kind === "CREATE_AUTH_IDENTITY" || operation.kind === "REUSE" && operation.resourceKey.startsWith("authentication-identity:")) {
    const expectedKey = `authentication-identity:${user.authentication.identityId ?? user.authentication.loginIdentifier}`;
    if (
      operation.resourceKey !== expectedKey ||
      (user.authentication.identityId !== undefined && operation.id !== user.authentication.identityId) ||
      (operation.kind === "CREATE_AUTH_IDENTITY" && user.authentication.identityId !== undefined && operation.id !== user.authentication.identityId)
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared authentication identity operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("AUTHENTICATION_IDENTITY");
    return;
  }
  if (operation.kind === "ADD_PROJECT_MEMBER" || operation.kind === "REUSE" && operation.resourceKey.startsWith("membership:")) {
    if (operation.resourceKey !== `membership:${user.membership.id}` || operation.id !== user.membership.id) {
      throw executionError("PREPARED_EXECUTION", "Prepared membership operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("MEMBERSHIP");
    return;
  }
  if (operation.kind === "CHANGE_ORDINARY_ROLE" || operation.kind === "REUSE" && operation.resourceKey.startsWith("role-assignment:")) {
    if (
      !isOrdinaryRole(user.role) ||
      operation.resourceKey !== `role-assignment:${user.roleAssignmentId}` ||
      operation.id !== user.roleAssignmentId ||
      operation.role !== user.role
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared ordinary-role operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    if (operation.kind === "CHANGE_ORDINARY_ROLE" && isReplacementRole(user.role)) {
      const expected = expectedPredecessor(manifest, user);
      if (!predecessorMatches(operation.expectedPredecessor, expected)) {
        throw executionError("PREPARED_EXECUTION", "Prepared ordinary-role predecessor does not match the manifest.", { runCorrelationId: "validation" });
      }
    }
    categories.add("ORDINARY_ROLE");
    return;
  }
  if (operation.kind === "APPOINT_PROTECTED_ROLE" || operation.kind === "REUSE" && operation.resourceKey.startsWith("protected-role:")) {
    if (
      !isProtectedRole(user.role) ||
      operation.resourceKey !== `protected-role:${user.role}` ||
      operation.id !== user.roleAssignmentId ||
      operation.role !== user.role ||
      (operation.kind === "APPOINT_PROTECTED_ROLE" && operation.reason !== user.protectedRoleReason) ||
      !user.protectedTransferId
    ) {
      throw executionError("PREPARED_EXECUTION", "Prepared protected-role operation does not match the manifest.", { runCorrelationId: "validation" });
    }
    categories.add("PROTECTED_ROLE");
    return;
  }

  throw executionError("UNSUPPORTED_OPERATION", "Prepared operation has no supported mapping.", { runCorrelationId: "validation" });
}


async function executeIdentityPhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: IdentityPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  for (const user of manifest.users) {
    const userOperations = operations.filter((operation) => operation.manifestKey === user.key);
    if (userOperations.length === 0) continue;
    const result = await safely(
      "IDENTITY",
      userOperations[0],
      context,
      outcomes,
      () => service.preparePilotIdentity(
        identityIntent(user),
        context,
        identityResourceActions(userOperations),
      ),
    );
    for (const operation of userOperations) {
      const resource = identityResource(operation, result.resources);
      appendOutcome(operation, "Identity", resource.id, resource.status, context, outcomes);
    }
  }
}


async function executeProjectPhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: ProjectsPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  const operation = operations[0];
  const result = await safely(
    "PROJECT",
    operation,
    context,
    outcomes,
    () => service.preparePilotProject({
      manifestProjectKey: "project",
      project: projectIntent(manifest),
    }, context, operation.kind === "CREATE_PROJECT" ? "CREATE" : "REUSE"),
  );
  const resource = requireResource(result.resources, "PROJECT", operation, context, outcomes);
  appendOutcome(operation, "Projects", resource.id, resource.status, context, outcomes);
}


async function executeProjectHealthPhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: ProjectHealthPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  const operation = operations[0];
  const result = await safely(
    "PROJECT_HEALTH",
    operation,
    context,
    outcomes,
    () => service.preparePilotHealth({
      manifestProjectKey: "project",
      projectId: manifest.project.id,
      healthStatus: manifest.project.health.status,
      reasons: manifest.project.health.reasons,
      source: manifest.project.health.source as "system" | "manual" | "agent",
      changedBy: manifest.project.health.changedBy,
    }, context, operation.kind === "CREATE_PROJECT_HEALTH" ? "CREATE" : "REUSE"),
  );
  const resource = requireResource(result.resources, "PROJECT_HEALTH", operation, context, outcomes);
  appendOutcome(operation, "Project Health", resource.id, resource.status, context, outcomes);
}


async function executeMembershipPhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: MembershipPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  for (const operation of operations) {
    const user = requireUser(manifest, operation);
    const request: PilotMembershipPreparationRequest = {
      action: operation.kind === "ADD_PROJECT_MEMBER" ? "CREATE" : "REUSE",
      intent: {
        resourceKey: operation.resourceKey,
        membershipId: user.membership.id,
        projectId: manifest.project.id,
        personId: user.person.id,
        effectiveFrom: user.membership.effectiveFrom,
        effectiveTo: user.membership.effectiveTo,
        status: "ACTIVE",
        grantedByPersonId: user.membership.grantedByPersonId,
        initialRoleAssignmentId: user.membership.initialRoleAssignmentId,
      },
      context,
    };
    const result = await safely("MEMBERSHIP", operation, context, outcomes, () => service.prepareMembership(request));
    appendOutcome(operation, "Project Membership", result.resourceId, result.actualResult, context, outcomes);
  }
}


async function executeOrdinaryRolePhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: MembershipPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  for (const operation of operations) {
    const user = requireUser(manifest, operation);
    const request: PilotOrdinaryRolePreparationRequest = {
      action: operation.kind === "CHANGE_ORDINARY_ROLE" ? "CREATE" : "REUSE",
      intent: {
        resourceKey: operation.resourceKey,
        assignmentId: user.roleAssignmentId,
        projectId: manifest.project.id,
        membershipId: user.membership.id,
        role: user.role as "PROJECT_MEMBER" | "PROJECT_OBSERVER" | "PROJECT_AUDITOR",
        effectiveFrom: user.membership.effectiveFrom,
        effectiveTo: user.membership.effectiveTo,
        assignedByPersonId: user.membership.grantedByPersonId,
        changeReason: user.protectedRoleReason ?? null,
        ...(operation.expectedPredecessor ? {
          expectedPredecessor: {
            assignmentId: operation.expectedPredecessor.assignmentId,
            projectId: operation.expectedPredecessor.projectId,
            membershipId: operation.expectedPredecessor.membershipId,
            role: operation.expectedPredecessor.role,
            effectiveFrom: operation.expectedPredecessor.effectiveFrom,
            effectiveTo: operation.expectedPredecessor.effectiveTo,
            assignedByPersonId: operation.expectedPredecessor.assignedByPersonId,
            changeReason: operation.expectedPredecessor.changeReason,
          },
        } : {}),
      },
      context,
    };
    const result = await safely("ORDINARY_ROLE", operation, context, outcomes, () => service.prepareOrdinaryRoleAssignment(request));
    appendOutcome(operation, "Project Membership", result.resourceId, result.actualResult, context, outcomes);
  }
}


async function executeProtectedRolePhase(
  operations: readonly PilotPlanOperation[],
  manifest: ValidatedPilotManifest,
  service: MembershipPreparationService,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): Promise<void> {
  for (const operation of operations) {
    const user = requireUser(manifest, operation);
    const request: PilotProtectedRolePreparationRequest = {
      action: operation.kind === "APPOINT_PROTECTED_ROLE" ? "APPOINT" : "REUSE",
      intent: {
        resourceKey: operation.resourceKey,
        assignmentId: user.roleAssignmentId,
        transferId: user.protectedTransferId!,
        projectId: manifest.project.id,
        membershipId: user.membership.id,
        role: user.role as "PROJECT_OWNER" | "PROJECT_MANAGER" | "PROJECT_SPONSOR",
        effectiveAt: user.membership.effectiveFrom,
        effectiveTo: user.membership.effectiveTo,
        authorisedByPersonId: context.operatorPersonId,
        reason: user.protectedRoleReason!,
      },
      context,
    };
    const result = await safely("PROTECTED_ROLE", operation, context, outcomes, () => service.prepareProtectedRoleAppointment(request));
    appendOutcome(operation, "Project Membership", result.resourceId, result.actualResult, context, outcomes);
  }
}


function identityIntent(user: PilotUserIntent): PilotIdentityPreparationIntent {
  return {
    manifestUserKey: user.key,
    person: {
      kind: user.person.kind,
      id: user.person.id,
      displayName: user.person.displayName ?? user.displayName,
    },
    cadenceUser: user.cadenceUser,
    authentication: {
      ...user.authentication,
      validFrom: user.membership.effectiveFrom,
      validTo: user.membership.effectiveTo,
    },
  };
}


function identityResourceActions(
  operations: readonly PilotPlanOperation[],
): PilotIdentityResourceActions {
  const actions: {
    AUTH_ACCOUNT?: "CREATE" | "REUSE";
    PERSON?: "CREATE" | "REUSE";
    CADENCE_USER?: "CREATE" | "REUSE";
    AUTHENTICATION_IDENTITY?: "CREATE" | "REUSE";
  } = {};
  for (const operation of operations) {
    const resource = operation.kind === "CREATE_PERSON" || operation.resourceKey.startsWith("person:")
      ? "PERSON"
      : operation.kind === "CREATE_CADENCE_USER" || operation.resourceKey.startsWith("cadence-user:")
        ? "CADENCE_USER"
        : operation.kind === "CREATE_AUTH_ACCOUNT" || operation.resourceKey.startsWith("auth-account:")
          ? "AUTH_ACCOUNT"
          : "AUTHENTICATION_IDENTITY";
    actions[resource] = operation.kind === "REUSE" ? "REUSE" : "CREATE";
  }
  return actions;
}


function projectIntent(manifest: ValidatedPilotManifest): PilotProjectPreparationIntent["project"] {
  const project = manifest.project;
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


function identityResource(
  operation: PilotPlanOperation,
  resources: readonly PilotPreparationResourceEvidence[],
): PilotPreparationResourceEvidence {
  const resource = operation.kind === "CREATE_PERSON" || operation.resourceKey.startsWith("person:")
    ? "PERSON"
    : operation.kind === "CREATE_CADENCE_USER" || operation.resourceKey.startsWith("cadence-user:")
      ? "CADENCE_USER"
      : operation.kind === "CREATE_AUTH_ACCOUNT" || operation.resourceKey.startsWith("auth-account:")
        ? "AUTH_ACCOUNT"
        : "AUTHENTICATION_IDENTITY";
  const found = resources.find((candidate) => candidate.resource === resource);
  if (!found || operation.kind === "REUSE" && found.status !== "REUSED") {
    throw executionError("PREPARED_EXECUTION", "Identity preparation returned an incompatible resource outcome.", {
      runCorrelationId: "execution",
      failedOperation: { resourceKey: operation.resourceKey, kind: operation.kind },
    });
  }
  if (operation.id !== undefined && found.id !== operation.id) {
    throw executionError("PREPARED_EXECUTION", "Identity preparation returned the wrong resource identity.", {
      runCorrelationId: "execution",
      failedOperation: { resourceKey: operation.resourceKey, kind: operation.kind },
    });
  }
  if (operation.kind !== "REUSE" && found.status !== "CREATED" && found.status !== "REUSED") {
    throw executionError("IDENTITY", "Identity preparation returned an invalid result.", {
      runCorrelationId: "execution",
      failedOperation: { resourceKey: operation.resourceKey, kind: operation.kind },
    });
  }
  return found;
}


function requireResource<T extends { resource: string; status: "CREATED" | "REUSED"; id: string }>(
  resources: readonly T[],
  resourceName: string,
  operation: PilotPlanOperation,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: readonly PilotExecutionOutcome[],
): T {
  const resource = resources.find((candidate) => candidate.resource === resourceName);
  if (!resource || operation.kind === "REUSE" && resource.status !== "REUSED") {
    throw executionError("PREPARED_EXECUTION", "Owning preparation returned an incompatible resource outcome.", context, operation, outcomes);
  }
  if (operation.id !== undefined && resource.id !== operation.id) {
    throw executionError("PREPARED_EXECUTION", "Owning preparation returned the wrong resource identity.", context, operation, outcomes);
  }
  return resource;
}


async function safely<T>(
  category: PilotExecutionErrorCategory,
  operation: PilotPlanOperation,
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: readonly PilotExecutionOutcome[],
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ControlledPilotExecutionError) throw error;
    const stale = operation.kind === "REUSE" && isStaleError(error);
    throw executionError(
      stale ? "STALE_PLAN" : category,
      stale ? "Prepared reuse target is stale." : "Owning preparation failed safely.",
      context,
      operation,
      outcomes,
    );
  }
}


function isStaleError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "STALE_PLAN";
}


function appendOutcome(
  operation: PilotPlanOperation,
  owningModule: PilotExecutionModule,
  resourceId: string,
  actualResult: "CREATED" | "REUSED",
  context: { operatorPersonId: string; runCorrelationId: string },
  outcomes: PilotExecutionOutcome[],
): void {
  if (operation.kind === "REUSE" && actualResult !== "REUSED") {
    throw executionError("STALE_PLAN", "A prepared reuse operation did not reuse its target.", context, operation, outcomes);
  }
  outcomes.push({
    resourceKey: operation.resourceKey,
    plannedOperation: operation.kind,
    owningModule,
    resourceId,
    actualResult,
    operatorPersonId: context.operatorPersonId,
    runCorrelationId: context.runCorrelationId,
  });
}


function requireUser(
  manifest: ValidatedPilotManifest,
  operation: PilotPlanOperation,
): PilotUserIntent {
  const user = manifest.users.find((candidate) => candidate.key === operation.manifestKey);
  if (!user) {
    throw executionError("PREPARED_EXECUTION", "Prepared operation has no valid user intent.", { runCorrelationId: "execution" }, operation);
  }
  return user;
}


function operationPhase(operation: PilotPlanOperation): Phase {
  switch (operation.kind) {
    case "CREATE_PERSON":
    case "CREATE_CADENCE_USER":
    case "CREATE_AUTH_ACCOUNT":
    case "CREATE_AUTH_IDENTITY":
      return "IDENTITY";
    case "CREATE_PROJECT":
      return "PROJECT";
    case "CREATE_PROJECT_HEALTH":
      return "PROJECT_HEALTH";
    case "ADD_PROJECT_MEMBER":
      return "MEMBERSHIP";
    case "CHANGE_ORDINARY_ROLE":
      return "ORDINARY_ROLE";
    case "APPOINT_PROTECTED_ROLE":
      return "PROTECTED_ROLE";
    case "REUSE":
      if (operation.resourceKey.startsWith("person:") || operation.resourceKey.startsWith("cadence-user:") || operation.resourceKey.startsWith("auth-account:") || operation.resourceKey.startsWith("authentication-identity:")) return "IDENTITY";
      if (operation.resourceKey.startsWith("project:")) return "PROJECT";
      if (operation.resourceKey.startsWith("project-health:")) return "PROJECT_HEALTH";
      if (operation.resourceKey.startsWith("membership:")) return "MEMBERSHIP";
      if (operation.resourceKey.startsWith("role-assignment:")) return "ORDINARY_ROLE";
      if (operation.resourceKey.startsWith("protected-role:")) return "PROTECTED_ROLE";
      throw executionError("UNSUPPORTED_OPERATION", "Prepared reuse resource has no phase.", { runCorrelationId: "validation" });
  }
}


function isSupportedOperation(kind: unknown): kind is PilotPlanOperationKind {
  return kind === "CREATE_PERSON" ||
    kind === "CREATE_CADENCE_USER" ||
    kind === "CREATE_AUTH_ACCOUNT" ||
    kind === "CREATE_AUTH_IDENTITY" ||
    kind === "CREATE_PROJECT" ||
    kind === "CREATE_PROJECT_HEALTH" ||
    kind === "ADD_PROJECT_MEMBER" ||
    kind === "CHANGE_ORDINARY_ROLE" ||
    kind === "APPOINT_PROTECTED_ROLE" ||
    kind === "REUSE";
}


function isProtectedRole(role: PilotUserIntent["role"]): boolean {
  return role === "PROJECT_OWNER" || role === "PROJECT_MANAGER" || role === "PROJECT_SPONSOR";
}


function isReplacementRole(role: PilotUserIntent["role"]): boolean {
  return role === "PROJECT_OBSERVER" || role === "PROJECT_AUDITOR";
}


function isOrdinaryRole(role: PilotUserIntent["role"]): boolean {
  return role === "PROJECT_MEMBER" || isReplacementRole(role);
}


function expectedPredecessor(
  manifest: ValidatedPilotManifest,
  user: PilotUserIntent,
) {
  return {
    assignmentId: user.membership.initialRoleAssignmentId,
    projectId: manifest.project.id,
    membershipId: user.membership.id,
    role: "PROJECT_MEMBER" as const,
    effectiveFrom: user.membership.effectiveFrom,
    effectiveTo: user.membership.effectiveTo,
    assignedByPersonId: user.membership.grantedByPersonId,
    changeReason: null,
  };
}


function predecessorMatches(
  actual: PilotPlanOperation["expectedPredecessor"],
  expected: ReturnType<typeof expectedPredecessor>,
): boolean {
  return actual !== undefined &&
    actual.assignmentId === expected.assignmentId &&
    actual.projectId === expected.projectId &&
    actual.membershipId === expected.membershipId &&
    actual.role === expected.role &&
    actual.effectiveFrom === expected.effectiveFrom &&
    actual.effectiveTo === expected.effectiveTo &&
    actual.assignedByPersonId === expected.assignedByPersonId &&
    actual.changeReason === expected.changeReason;
}


function executionError(
  category: PilotExecutionErrorCategory,
  message: string,
  context: {
    manifestId?: string;
    manifestHash?: string;
    runCorrelationId: string;
    failedOperation?: {
      resourceKey: string;
      kind: PilotPlanOperationKind | string;
    };
  },
  operation?: PilotPlanOperation,
  completedOutcomes: readonly PilotExecutionOutcome[] = [],
): ControlledPilotExecutionError {
  return new ControlledPilotExecutionError(category, message, {
    ...context,
    failedOperation: context.failedOperation ?? (operation
      ? { resourceKey: operation.resourceKey, kind: operation.kind }
      : undefined),
    completedOutcomes,
  });
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
