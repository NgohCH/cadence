import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  computeManifestHash,
  validatePilotManifest,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import type {
  PilotPlanOperation,
  PilotPreflightPlan,
  PilotRuntimeTarget,
} from "./vs004-preflight";
import {
  executeControlledPilot,
  type ControlledPilotExecutionServices,
  type PilotExecutionResult,
} from "./vs004-controlled-pilot-execution";
import type { PilotIdentityPreparationResult } from "../src/modules/identity/pilot-preparation.types";
import type { PilotProjectPreparationResult } from "../src/modules/projects/pilot-preparation.types";
import type { PilotProjectHealthPreparationResult } from "../src/modules/project-health/pilot-preparation.types";
import type {
  PilotPreparationOutcome,
} from "../src/modules/project-membership/pilot-preparation.types";


const runCorrelationId = "00449000-0000-4000-8000-000000000099";
const target: PilotRuntimeTarget = Object.assign({
  cadenceEnv: "local",
  supabaseUrl: "http://127.0.0.1:54321",
  supabaseProjectRef: undefined,
  safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
}, { projectId: "00440000-0000-4000-8000-000000000001" });


function manifest(): ValidatedPilotManifest {
  return validatePilotManifest(
    JSON.parse(
      readFileSync(
        resolve(__dirname, "vs004-pilot.example.json"),
        "utf8",
      ),
    ),
  );
}


function ordinaryPredecessor(
  pilotManifest: ValidatedPilotManifest,
  user: ValidatedPilotManifest["users"][number],
) {
  return {
    assignmentId: user.membership.initialRoleAssignmentId,
    projectId: pilotManifest.project.id,
    membershipId: user.membership.id,
    role: "PROJECT_MEMBER" as const,
    effectiveFrom: user.membership.effectiveFrom,
    effectiveTo: user.membership.effectiveTo,
    assignedByPersonId: user.membership.grantedByPersonId,
    changeReason: null,
  };
}


function completeOperations(
  pilotManifest: ValidatedPilotManifest,
  action: "CREATE" | "REUSE" = "CREATE",
): PilotPlanOperation[] {
  const operations: PilotPlanOperation[] = [
    {
      kind: action === "CREATE" ? "CREATE_PROJECT" : "REUSE",
      resourceKey: `project:${pilotManifest.project.id}`,
      id: pilotManifest.project.id,
      ...(action === "CREATE" ? { progressPercent: pilotManifest.project.progressPercent } : {}),
    },
    {
      kind: action === "CREATE" ? "CREATE_PROJECT_HEALTH" : "REUSE",
      resourceKey: `project-health:${pilotManifest.project.id}`,
      id: pilotManifest.project.id,
    },
  ];

  for (const user of pilotManifest.users) {
    operations.push(
      {
        kind: action === "CREATE" ? "CREATE_PERSON" : "REUSE",
        resourceKey: `person:${user.person.id}`,
        manifestKey: user.key,
        id: user.person.id,
      },
      {
        kind: action === "CREATE" ? "CREATE_CADENCE_USER" : "REUSE",
        resourceKey: `cadence-user:${user.cadenceUser.id}`,
        manifestKey: user.key,
        id: user.cadenceUser.id,
      },
      {
        kind: action === "CREATE" ? "CREATE_AUTH_ACCOUNT" : "REUSE",
        resourceKey: `auth-account:${user.authentication.provider}:${user.authentication.providerSubjectId ?? user.authentication.loginIdentifier}`,
        manifestKey: user.key,
        ...(action === "REUSE" ? { id: user.authentication.providerSubjectId } : {}),
      },
      {
        kind: action === "CREATE" ? "CREATE_AUTH_IDENTITY" : "REUSE",
        resourceKey: `authentication-identity:${user.authentication.identityId}`,
        manifestKey: user.key,
        id: user.authentication.identityId,
      },
      {
        kind: action === "CREATE" ? "ADD_PROJECT_MEMBER" : "REUSE",
        resourceKey: `membership:${user.membership.id}`,
        manifestKey: user.key,
        id: user.membership.id,
      },
    );

    if (user.role === "PROJECT_OBSERVER" || user.role === "PROJECT_AUDITOR") {
      operations.push({
        kind: action === "CREATE" ? "CHANGE_ORDINARY_ROLE" : "REUSE",
        resourceKey: `role-assignment:${user.roleAssignmentId}`,
        manifestKey: user.key,
        id: user.roleAssignmentId,
        role: user.role,
        ...(action === "CREATE" ? {
          expectedPredecessor: ordinaryPredecessor(pilotManifest, user),
        } : {}),
      });
    }

    if (
      user.role === "PROJECT_OWNER" ||
      user.role === "PROJECT_MANAGER" ||
      user.role === "PROJECT_SPONSOR"
    ) {
      operations.push({
        kind: action === "CREATE" ? "APPOINT_PROTECTED_ROLE" : "REUSE",
        resourceKey: `protected-role:${user.role}`,
        manifestKey: user.key,
        id: user.roleAssignmentId,
        role: user.role,
        ...(action === "CREATE" ? { reason: user.protectedRoleReason } : {}),
      });
    }
  }

  return operations;
}


function prepared(
  pilotManifest = manifest(),
  operations = completeOperations(pilotManifest),
  overrides: Partial<{
    manifestId: string;
    manifestHash: string;
    operatorPersonId: string;
    runCorrelationId: string;
    target: Partial<PilotRuntimeTarget> & { projectId?: string };
    preflightPlan: Partial<PilotPreflightPlan>;
  }> = {},
) {
  const hash = computeManifestHash(pilotManifest);
  const plan: PilotPreflightPlan = {
    manifestId: pilotManifest.manifestId,
    manifestHash: hash,
    target: {
      environment: pilotManifest.target.environment,
      projectId: pilotManifest.project.id,
      safeTargetMarker: pilotManifest.target.safeTargetMarker,
    },
    operatorPersonId: pilotManifest.operator.personId,
    runCorrelationId,
    operations,
    ...overrides.preflightPlan,
  };
  return {
    manifestId: overrides.manifestId ?? pilotManifest.manifestId,
    manifestHash: overrides.manifestHash ?? hash,
    target: {
      environment: pilotManifest.target.environment,
      supabaseUrl: target.supabaseUrl!,
      supabaseProjectRef: null,
      projectId: pilotManifest.project.id,
      safeTargetMarker: pilotManifest.target.safeTargetMarker,
      ...overrides.target,
    },
    operatorPersonId: overrides.operatorPersonId ?? pilotManifest.operator.personId,
    runCorrelationId: overrides.runCorrelationId ?? runCorrelationId,
    validatedManifest: pilotManifest,
    observedEvidence: {
      observedAt: "2026-09-02T00:00:00.000Z",
      userCount: pilotManifest.users.length,
      personCount: pilotManifest.users.length + 1,
      cadenceUserCount: pilotManifest.users.length,
      authenticationIdentityCount: pilotManifest.users.length,
      authAccountCount: pilotManifest.users.length,
      projectCount: 1,
      membershipCount: pilotManifest.users.length,
      roleAssignmentCount: pilotManifest.users.length,
      protectedTransferCount: 3,
    },
    preflightPlan: plan,
  };
}


type ServiceOptions = {
  result?: "CREATED" | "REUSED";
  failOn?: string;
};


function fakeServices(
  events: string[],
  options: ServiceOptions = {},
): ControlledPilotExecutionServices {
  const result = options.result ?? "CREATED";
  const maybeFail = (resourceKey: string): void => {
    if (options.failOn === resourceKey) {
      throw new Error("secret provider failure");
    }
  };
  const identity: ControlledPilotExecutionServices["identity"] = {
    async preparePilotIdentity(intent, context): Promise<PilotIdentityPreparationResult> {
      events.push(`identity:${intent.manifestUserKey}`);
      maybeFail(`identity:${intent.manifestUserKey}`);
      return {
        resources: [
          { resource: "AUTH_ACCOUNT", status: result, id: intent.authentication.providerSubjectId ?? "auth" },
          { resource: "PERSON", status: result, id: intent.person.id },
          { resource: "CADENCE_USER", status: result, id: intent.cadenceUser.id },
          { resource: "AUTHENTICATION_IDENTITY", status: result, id: intent.authentication.identityId ?? "identity" },
        ],
        evidence: {
          manifestUserKey: intent.manifestUserKey,
          personId: intent.person.id,
          cadenceUserId: intent.cadenceUser.id,
          provider: intent.authentication.provider,
          providerSubjectId: intent.authentication.providerSubjectId ?? "subject",
          operatorPersonId: context.operatorPersonId,
          runCorrelationId: context.runCorrelationId,
        },
      };
    },
  };
  const projects: ControlledPilotExecutionServices["projects"] = {
    async preparePilotProject(intent, context): Promise<PilotProjectPreparationResult> {
      events.push("project");
      maybeFail("project");
      return {
        resources: [{ resource: "PROJECT", status: result, id: intent.project.id }],
        evidence: {
          manifestProjectKey: intent.manifestProjectKey,
          projectId: intent.project.id,
          operatorPersonId: context.operatorPersonId,
          runCorrelationId: context.runCorrelationId,
          lifecycleStatus: intent.project.lifecycleStatus,
        },
      };
    },
  };
  const projectHealth: ControlledPilotExecutionServices["projectHealth"] = {
    async preparePilotHealth(intent, context): Promise<PilotProjectHealthPreparationResult> {
      events.push("health");
      maybeFail("health");
      return {
        resources: [{ resource: "PROJECT_HEALTH", status: result, id: intent.projectId }],
        evidence: {
          manifestProjectKey: intent.manifestProjectKey,
          projectId: intent.projectId,
          projectHealthId: intent.projectId,
          operatorPersonId: context.operatorPersonId,
          runCorrelationId: context.runCorrelationId,
          healthStatus: intent.healthStatus,
        },
      };
    },
  };
  const membership: ControlledPilotExecutionServices["membership"] = {
    async prepareMembership(request): Promise<PilotPreparationOutcome> {
      events.push(`membership:${request.intent.resourceKey}`);
      maybeFail(request.intent.resourceKey);
      return outcome(request.intent.resourceKey, request.action, result, request.intent.membershipId, request.context, request.intent.projectId);
    },
    async prepareOrdinaryRoleAssignment(request): Promise<PilotPreparationOutcome> {
      events.push(`ordinary:${request.intent.resourceKey}`);
      maybeFail(request.intent.resourceKey);
      return outcome(request.intent.resourceKey, request.action, result, request.intent.assignmentId, request.context, request.intent.projectId);
    },
    async prepareProtectedRoleAppointment(request): Promise<PilotPreparationOutcome> {
      events.push(`protected:${request.intent.role}`);
      maybeFail(request.intent.resourceKey);
      return outcome(request.intent.resourceKey, request.action, result, request.intent.assignmentId, request.context, request.intent.projectId);
    },
  };
  return { identity, projects, projectHealth, membership };
}


function outcome(
  resourceKey: string,
  plannedAction: "CREATE" | "REUSE" | "APPOINT",
  actualResult: "CREATED" | "REUSED",
  resourceId: string,
  context: { operatorPersonId: string; runCorrelationId: string },
  projectId: string,
): PilotPreparationOutcome {
  return {
    resourceKey,
    plannedAction,
    actualResult,
    resourceId,
    projectId,
    operatorPersonId: context.operatorPersonId,
    runCorrelationId: context.runCorrelationId,
  };
}


function executionInput(
  pilotManifest = manifest(),
  operations = completeOperations(pilotManifest),
  options: ServiceOptions = {},
) {
  const events: string[] = [];
  return {
    input: {
      prepared: prepared(pilotManifest, operations),
      runtimeTarget: target,
      services: fakeServices(events, options),
    },
    events,
  };
}


test("executes a valid prepared plan and returns immutable credential-free evidence", async () => {
  const { input } = executionInput();
  const result = await executeControlledPilot(input, {
    now: () => "2026-09-02T01:00:00.000Z",
  });

  assert.equal(result.manifestId, input.prepared.manifestId);
  assert.equal(result.manifestHash, input.prepared.manifestHash);
  assert.equal(result.runCorrelationId, runCorrelationId);
  assert.equal(result.outcomes.length, input.prepared.preflightPlan.operations.length);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal("repository" in input.services, false);
});


test("rejects prepared hash, ID, operator, project, and correlation mismatches before service calls", async (t) => {
  const cases = [
    ["hash", { manifestHash: "not-the-hash" }],
    ["manifest ID", { manifestId: "wrong-manifest" }],
    ["operator", { operatorPersonId: "00441000-0000-4000-8000-000000000099" }],
    ["correlation", { runCorrelationId: " " }],
  ] as const;
  for (const [label, override] of cases) {
    await t.test(label, async () => {
      const { input, events } = executionInput();
      Object.assign(input.prepared, override);
      await assert.rejects(
        executeControlledPilot(input),
        (error: { category?: string }) =>
          error.category === "PREPARED_EXECUTION",
      );
      assert.deepEqual(events, []);
    });
  }

  const { input, events } = executionInput();
  input.prepared.target.projectId = "00440000-0000-4000-8000-000000000099";
  await assert.rejects(
    executeControlledPilot(input),
    (error: { category?: string }) => error.category === "TARGET",
  );
  assert.deepEqual(events, []);
});


test("revalidates environment, URL, project reference, and safe target before calls", async (t) => {
  const mismatches: Array<[string, PilotRuntimeTarget]> = [
    ["environment", { ...target, cadenceEnv: "qa" }],
    ["URL", { ...target, supabaseUrl: "http://127.0.0.1:54322" }],
    ["project reference", { ...target, supabaseProjectRef: "unexpected-ref" }],
    ["safe marker", { ...target, safeTargetMarker: "WRONG" }],
    ["project", Object.assign({}, target, { projectId: "00440000-0000-4000-8000-000000000099" })],
  ];
  for (const [label, runtimeTarget] of mismatches) {
    await t.test(label, async () => {
      const { input, events } = executionInput();
      input.runtimeTarget = runtimeTarget;
      await assert.rejects(
        executeControlledPilot(input),
        (error: { category?: string }) => error.category === "TARGET",
      );
      assert.deepEqual(events, []);
    });
  }
});


test("rejects unknown, duplicate, and operation-manifest mismatches before calls", async (t) => {
  const pilotManifest = manifest();
  const unknown = completeOperations(pilotManifest);
  unknown[0] = { ...unknown[0], kind: "DELETE" as never };
  const duplicate = completeOperations(pilotManifest);
  duplicate.push({ ...duplicate[0] });
  const wrongRole = completeOperations(pilotManifest);
  const observer = pilotManifest.users.find((user) => user.role === "PROJECT_OBSERVER")!;
  const observerOp = wrongRole.find((operation) => operation.manifestKey === observer.key && operation.kind === "CHANGE_ORDINARY_ROLE")!;
  observerOp.role = "PROJECT_AUDITOR";
  const wrongId = completeOperations(pilotManifest);
  wrongId[2].id = "00445000-0000-4000-8000-000000000099";
  const forgedAuthAccount = completeOperations(pilotManifest);
  forgedAuthAccount.push({
    kind: "REUSE",
    resourceKey: "auth-account:local:forged",
    manifestKey: pilotManifest.users[0].key,
    id: "forged-auth-account",
  });

  for (const operations of [unknown, duplicate, wrongRole, wrongId, forgedAuthAccount]) {
    const { input, events } = executionInput(pilotManifest, operations);
    await assert.rejects(
      executeControlledPilot(input),
      (error: { category?: string }) =>
        error.category === "UNSUPPORTED_OPERATION" ||
        error.category === "PREPARED_EXECUTION",
    );
    assert.deepEqual(events, []);
  }
});


test("orders dispatch by dependency phase and never invokes a planner", async () => {
  const { input, events } = executionInput();
  input.prepared.preflightPlan.operations = [...input.prepared.preflightPlan.operations].reverse();
  await executeControlledPilot(input);

  const lastIdentity = Math.max(...events.map((event, index) => event.startsWith("identity:") ? index : -1));
  const projectIndex = events.indexOf("project");
  const healthIndex = events.indexOf("health");
  const firstMembership = events.findIndex((event) => event.startsWith("membership:"));
  const firstOrdinary = events.findIndex((event) => event.startsWith("ordinary:"));
  const firstProtected = events.findIndex((event) => event.startsWith("protected:"));
  assert.ok(lastIdentity < projectIndex);
  assert.ok(projectIndex < healthIndex);
  assert.ok(healthIndex < firstMembership);
  assert.ok(firstMembership < firstOrdinary);
  assert.ok(firstOrdinary < firstProtected);
});


test("passes exact Identity, Project, Health, and membership intents to owning services", async () => {
  const { input } = executionInput();
  const calls: unknown[] = [];
  let projectIntent: unknown;
  let healthIntent: unknown;
  let membershipIntent: unknown;
  const services = fakeServices([]);
  const originalIdentity = services.identity.preparePilotIdentity;
  services.identity.preparePilotIdentity = async (intent, context) => {
    calls.push({ intent, context });
    return originalIdentity(intent, context);
  };
  const originalProject = services.projects.preparePilotProject;
  services.projects.preparePilotProject = async (intent, context) => {
    projectIntent = intent;
    return originalProject(intent, context);
  };
  const originalHealth = services.projectHealth.preparePilotHealth;
  services.projectHealth.preparePilotHealth = async (intent, context) => {
    healthIntent = intent;
    return originalHealth(intent, context);
  };
  const originalMembership = services.membership.prepareMembership;
  services.membership.prepareMembership = async (request) => {
    membershipIntent = request.intent;
    return originalMembership(request);
  };
  input.services = services;
  const result = await executeControlledPilot(input);
  assert.equal(result.outcomes.every((outcome) => outcome.runCorrelationId === runCorrelationId), true);
  assert.equal(calls.length, manifest().users.length);
  const first = calls[0] as { intent: { person: { id: string }; authentication: { provider: string } } };
  assert.equal(first.intent.person.id, manifest().users[0].person.id);
  assert.equal(first.intent.authentication.provider, "local");
  assert.equal((projectIntent as { project: { id: string; progressPercent: number } }).project.id, manifest().project.id);
  assert.equal((projectIntent as { project: { progressPercent: number } }).project.progressPercent, 0);
  assert.equal((healthIntent as { projectId: string }).projectId, manifest().project.id);
  assert.equal((membershipIntent as { projectId: string }).projectId, manifest().project.id);
});


test("passes four independent Identity actions and maps one Auth-account outcome", async () => {
  const pilotManifest = manifest();
  const baseOperations = completeOperations(pilotManifest);
  const firstUser = pilotManifest.users[0];
  const authAccountOperation = baseOperations.find(
    (operation) => operation.manifestKey === firstUser.key && operation.kind === "CREATE_AUTH_ACCOUNT",
  )!;
  const personOperation = baseOperations.find(
    (operation) => operation.manifestKey === firstUser.key && operation.kind === "CREATE_PERSON",
  )!;
  const operations = baseOperations.map((operation) => {
    if (operation === authAccountOperation) {
      return { ...operation, kind: "REUSE" as const, id: firstUser.authentication.providerSubjectId };
    }
    if (operation === personOperation) {
      return { ...operation, kind: "REUSE" as const };
    }
    return operation;
  });

  let actions: unknown;
  const { input } = executionInput(pilotManifest, operations, { result: "REUSED" });
  const services = fakeServices([], { result: "REUSED" });
  const original = services.identity.preparePilotIdentity;
  services.identity.preparePilotIdentity = async (intent, context, resourceActions) => {
    if (intent.manifestUserKey === firstUser.key) actions = resourceActions;
    return original(intent, context, resourceActions);
  };
  input.services = services;

  const result = await executeControlledPilot(input);
  assert.deepEqual(actions, {
    AUTH_ACCOUNT: "REUSE",
    PERSON: "REUSE",
    CADENCE_USER: "CREATE",
    AUTHENTICATION_IDENTITY: "CREATE",
  });
  assert.equal(
    result.outcomes.filter((outcome) => outcome.resourceKey === authAccountOperation.resourceKey).length,
    1,
  );
});


test("passes expectedPredecessor unchanged and dispatches protected roles only as appointments", async () => {
  const pilotManifest = manifest();
  const operations = completeOperations(pilotManifest);
  const observer = pilotManifest.users.find((user) => user.role === "PROJECT_OBSERVER")!;
  const ordinaryOperation = operations.find((operation) => operation.manifestKey === observer.key && operation.kind === "CHANGE_ORDINARY_ROLE")!;
  const expectedPredecessor = ordinaryOperation.expectedPredecessor;
  let receivedPredecessor: unknown;
  let protectedAction: unknown;
  const { input } = executionInput(pilotManifest, operations);
  const services = fakeServices([]);
  const originalOrdinary = services.membership.prepareOrdinaryRoleAssignment;
  const originalProtected = services.membership.prepareProtectedRoleAppointment;
  services.membership.prepareOrdinaryRoleAssignment = async (request) => {
    receivedPredecessor = request.intent.expectedPredecessor;
    return originalOrdinary(request);
  };
  services.membership.prepareProtectedRoleAppointment = async (request) => {
    protectedAction = request.action;
    return originalProtected(request);
  };
  input.services = services;
  await executeControlledPilot(input);
  assert.deepEqual(receivedPredecessor, expectedPredecessor);
  assert.equal(protectedAction, "APPOINT");
});


test("accepts CREATE operations that race to an exact REUSED result", async () => {
  const { input } = executionInput(manifest(), completeOperations(manifest()), { result: "REUSED" });
  const result = await executeControlledPilot(input);
  assert.equal(result.outcomes.every((outcome) => outcome.actualResult === "REUSED"), true);
});


test("keeps REUSE read-only and converts a missing REUSE target into STALE_PLAN", async () => {
  const pilotManifest = manifest();
  const operations = completeOperations(pilotManifest, "REUSE");
  const { input, events } = executionInput(pilotManifest, operations, { result: "REUSED", failOn: "project" });
  let projectAction: string | undefined;
  const originalProject = input.services.projects.preparePilotProject;
  input.services.projects.preparePilotProject = async (intent, context, action) => {
    projectAction = action;
    return originalProject(intent, context, action);
  };
  await assert.rejects(
    executeControlledPilot(input),
    (error: { category?: string }) =>
      error.category === "STALE_PLAN" || error.category === "PROJECT",
  );
  assert.equal(events.filter((event) => event.startsWith("identity:")).length, pilotManifest.users.length);
  assert.equal(events.includes("project"), true);
  assert.equal(projectAction, "REUSE");
});


test("stops on the first hard failure and preserves prior outcomes without compensation", async () => {
  const { input, events } = executionInput(manifest(), completeOperations(manifest()), { failOn: "health" });
  await assert.rejects(
    executeControlledPilot(input),
    (error: { completedOutcomes?: PilotExecutionResult["outcomes"] }) => {
      assert.equal(error.completedOutcomes?.some((outcome) => outcome.owningModule === "Projects"), true);
      return true;
    },
  );
  assert.equal(events.includes("membership:"), false);
  assert.equal(events.some((event) => event.includes("delete") || event.includes("transfer")), false);
});


test("rejects missing dependency operations before any service call", async () => {
  const pilotManifest = manifest();
  const operations = completeOperations(pilotManifest).filter(
    (operation) => operation.kind !== "CREATE_PROJECT",
  );
  const { input, events } = executionInput(pilotManifest, operations);
  await assert.rejects(
    executeControlledPilot(input),
    (error: { category?: string }) => error.category === "PREPARED_EXECUTION",
  );
  assert.deepEqual(events, []);
});


test("requires an explicit Auth-account operation before Identity", async () => {
  const pilotManifest = manifest();
  const operations = completeOperations(pilotManifest).filter(
    (operation) => !(operation.kind === "CREATE_AUTH_ACCOUNT" && operation.manifestKey === pilotManifest.users[0].key),
  );
  const { input, events } = executionInput(pilotManifest, operations);

  await assert.rejects(
    executeControlledPilot(input),
    (error: { category?: string }) => error.category === "PREPARED_EXECUTION",
  );
  assert.deepEqual(events, []);
});
