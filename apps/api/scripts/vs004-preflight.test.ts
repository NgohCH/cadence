import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  computeManifestHash,
  validatePilotManifest,
  type ValidatedPilotManifest,
  type PilotUserIntent,
} from "./vs004-pilot-manifest";
import {
  buildPilotPreflightPlan,
  type ObservedPilotState,
  type PilotPreflightInput,
  type PilotPlanOperation,
  type ObservedProject,
} from "./vs004-preflight";
import type {
  PilotProjectCreateIntent,
} from "../src/modules/projects/pilot-preparation.types";


type MutableObservedPilotState = {
  -readonly [Key in keyof ObservedPilotState]:
    ObservedPilotState[Key] extends readonly (infer Item)[]
      ? Item[]
      : never;
};


const operatorPersonId =
  "00441000-0000-4000-8000-000000000001";
const runCorrelationId =
  "00449000-0000-4000-8000-000000000001";
const secondRunCorrelationId =
  "00449000-0000-4000-8000-000000000002";


function manifest(): ValidatedPilotManifest {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  );
  return validatePilotManifest(raw);
}


function manifestForCreation(): ValidatedPilotManifest {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  ) as { users: Array<{ person: Record<string, unknown> }> };
  for (const pilotUser of raw.users) {
    pilotUser.person.kind = "new";
    pilotUser.person.displayName =
      pilotUser.person.displayName ?? "New VS004 Person";
  }
  return validatePilotManifest(raw);
}


function manifestWithExplicitProgress(): ValidatedPilotManifest {
  const manifest = JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  (manifest.project as Record<string, unknown>).progressPercent = 0;
  return manifest as unknown as ValidatedPilotManifest;
}


function boundedManifest(): ValidatedPilotManifest {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  ) as { users: Array<{ membership: Record<string, unknown> }> };
  raw.users[0].membership.effectiveTo = "2026-10-01T00:00:00.000Z";
  return validatePilotManifest(raw);
}


function emptyState(): MutableObservedPilotState {
  return {
    authAccounts: [],
    persons: [{
      id: operatorPersonId,
      displayName: "VS004 Pilot Operator",
    }],
    cadenceUsers: [],
    authenticationIdentities: [],
    projects: [],
    projectHealth: [],
    memberships: [],
    roleAssignments: [],
    protectedTransfers: [],
  };
}


function input(
  pilotManifest = manifest(),
  observed = emptyState(),
  overrides: Partial<PilotPreflightInput> = {},
): PilotPreflightInput {
  return {
    manifest: pilotManifest,
    runtimeTarget: {
      cadenceEnv: "local",
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseProjectRef: undefined,
      safeTargetMarker: pilotManifest.target.safeTargetMarker,
    },
    observed,
    runCorrelationId,
    ...overrides,
  };
}


function existingState(
  pilotManifest = manifest(),
): MutableObservedPilotState {
  const state = emptyState();
  for (const pilotUser of pilotManifest.users) {
    state.persons.push({
      id: pilotUser.person.id,
      displayName:
        pilotUser.person.displayName ?? pilotUser.displayName,
    });
    state.authAccounts.push({
      id: pilotUser.authentication.providerSubjectId ??
        `auth-${pilotUser.key}`,
      provider: pilotUser.authentication.provider,
      providerSubjectId:
        pilotUser.authentication.providerSubjectId ??
        `subject-${pilotUser.key}`,
      loginIdentifier:
        pilotUser.authentication.loginIdentifier,
      status: "active",
    });
    state.authenticationIdentities.push({
      id:
        pilotUser.authentication.identityId ??
        `00550000-0000-4000-8000-${pilotUser.key}`,
      authUserId: pilotUser.authentication.providerSubjectId ??
        `auth-${pilotUser.key}`,
      personId: pilotUser.person.id,
      provider: pilotUser.authentication.provider,
      providerSubjectId:
        pilotUser.authentication.providerSubjectId ??
        `subject-${pilotUser.key}`,
      loginIdentifier:
        pilotUser.authentication.loginIdentifier,
      status: "active",
      validFrom: pilotUser.membership.effectiveFrom,
      validTo: null,
    });
    state.cadenceUsers.push({
      id: pilotUser.cadenceUser.id,
      authUserId:
        pilotUser.authentication.providerSubjectId ??
        `auth-${pilotUser.key}`,
      personId: pilotUser.person.id,
      username: pilotUser.cadenceUser.username,
      displayName: pilotUser.cadenceUser.displayName,
      email: pilotUser.cadenceUser.email,
      status: "active",
      identityProvider:
        pilotUser.cadenceUser.identityProvider,
    });
    state.memberships.push({
      id: pilotUser.membership.id,
      projectId: pilotManifest.project.id,
      personId: pilotUser.person.id,
      effectiveFrom: pilotUser.membership.effectiveFrom,
      effectiveTo: pilotUser.membership.effectiveTo,
      status: "ACTIVE",
      grantedByPersonId:
        pilotUser.membership.grantedByPersonId,
      createdAt: pilotUser.membership.effectiveFrom,
    });
    state.roleAssignments.push({
      id: pilotUser.roleAssignmentId,
      projectId: pilotManifest.project.id,
      membershipId: pilotUser.membership.id,
      role: pilotUser.role,
      effectiveFrom: pilotUser.membership.effectiveFrom,
      effectiveTo: pilotUser.membership.effectiveTo,
      assignedBy: pilotUser.membership.grantedByPersonId,
      changeReason: pilotUser.protectedRoleReason ?? null,
      createdAt: pilotUser.membership.effectiveFrom,
    });
    if (
      pilotUser.role === "PROJECT_OWNER" ||
      pilotUser.role === "PROJECT_MANAGER" ||
      pilotUser.role === "PROJECT_SPONSOR"
    ) {
      state.protectedTransfers.push({
        id: pilotUser.protectedTransferId!,
        projectId: pilotManifest.project.id,
        role: pilotUser.role,
        outgoingAssignmentId: null,
        incomingAssignmentId: pilotUser.roleAssignmentId,
        authorisedByPersonId: pilotManifest.operator.personId,
        reason: pilotUser.protectedRoleReason!,
        correlationId: "00551000-0000-4000-8000-000000000001",
        effectiveAt: pilotUser.membership.effectiveFrom,
        createdAt: pilotUser.membership.effectiveFrom,
      });
    }
  }

  state.projects.push({
    id: pilotManifest.project.id,
    name: pilotManifest.project.name,
    description: pilotManifest.project.description,
    goal: pilotManifest.project.goal,
    lifecycleStatus: pilotManifest.project.lifecycleStatus,
    progressPercent: pilotManifest.project.progressPercent,
    ownerUserId: pilotManifest.project.ownerUserId,
    startDate: pilotManifest.project.startDate,
    targetDate: pilotManifest.project.targetDate,
  });
  state.projectHealth.push({
    projectId: pilotManifest.project.id,
    ...pilotManifest.project.health,
  });
  return state;
}


function cloneState(state: ObservedPilotState): MutableObservedPilotState {
  return structuredClone(state) as MutableObservedPilotState;
}


function operationKinds(plan: { operations: readonly PilotPlanOperation[] }): string[] {
  return plan.operations.map((operation) => operation.kind);
}


test("plans the complete default topology from read-only in-memory state", () => {
  const pilotManifest = manifestForCreation();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  );

  assert.deepEqual(
    new Set(operationKinds(planned)),
    new Set([
      "CREATE_PERSON",
      "CREATE_CADENCE_USER",
      "CREATE_AUTH_IDENTITY",
      "CREATE_PROJECT",
      "CREATE_PROJECT_HEALTH",
      "ADD_PROJECT_MEMBER",
      "CHANGE_ORDINARY_ROLE",
      "APPOINT_PROTECTED_ROLE",
    ]),
  );
  assert.equal(planned.manifestHash, computeManifestHash(pilotManifest));
  assert.equal(planned.runCorrelationId, runCorrelationId);
});


test("ordinary replacement operations carry the exact declared initial predecessor", () => {
  const pilotManifest = manifestForCreation();
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);

  const operation = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  ).operations.find(
    (candidate) => candidate.kind === "CHANGE_ORDINARY_ROLE" &&
      candidate.manifestKey === observer.key,
  );

  assert.deepEqual(operation?.expectedPredecessor, {
    assignmentId: observer.membership.initialRoleAssignmentId,
    projectId: pilotManifest.project.id,
    membershipId: observer.membership.id,
    role: "PROJECT_MEMBER",
    effectiveFrom: observer.membership.effectiveFrom,
    effectiveTo: observer.membership.effectiveTo,
    assignedByPersonId: observer.membership.grantedByPersonId,
    changeReason: null,
  });
});


function observerStateWithAssignment(
  pilotManifest: ValidatedPilotManifest,
  assignment: ObservedPilotState["roleAssignments"][number],
): MutableObservedPilotState {
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);
  const state = emptyState();
  state.memberships.push({
    id: observer.membership.id,
    projectId: pilotManifest.project.id,
    personId: observer.person.id,
    effectiveFrom: observer.membership.effectiveFrom,
    effectiveTo: observer.membership.effectiveTo,
    status: "ACTIVE",
    grantedByPersonId: observer.membership.grantedByPersonId,
    createdAt: observer.membership.effectiveFrom,
  });
  state.roleAssignments.push(assignment);
  return state;
}


function observerPredecessor(
  pilotManifest: ValidatedPilotManifest,
  overrides: Partial<ObservedPilotState["roleAssignments"][number]> = {},
): ObservedPilotState["roleAssignments"][number] {
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);
  return {
    id: observer.membership.initialRoleAssignmentId,
    projectId: pilotManifest.project.id,
    membershipId: observer.membership.id,
    role: "PROJECT_MEMBER",
    effectiveFrom: observer.membership.effectiveFrom,
    effectiveTo: observer.membership.effectiveTo,
    assignedBy: observer.membership.grantedByPersonId,
    changeReason: null,
    createdAt: observer.membership.effectiveFrom,
    ...overrides,
  };
}


test("rejects an observed ordinary predecessor with the wrong assignment ID", () => {
  const pilotManifest = manifestForCreation();
  const observed = observerStateWithAssignment(
    pilotManifest,
    observerPredecessor(pilotManifest, {
      id: "00443000-0000-4000-8000-000000000099",
    }),
  );

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /ordinary role|ROLE|predecessor/i,
  );
});


test("rejects an observed predecessor with the correct ID but wrong role", () => {
  const pilotManifest = manifestForCreation();
  const observed = observerStateWithAssignment(
    pilotManifest,
    observerPredecessor(pilotManifest, { role: "PROJECT_AUDITOR" }),
  );

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /ordinary role|ROLE|predecessor/i,
  );
});


test("rejects an observed predecessor with the correct ID and role but wrong period", () => {
  const pilotManifest = manifestForCreation();
  const observed = observerStateWithAssignment(
    pilotManifest,
    observerPredecessor(pilotManifest, {
      effectiveFrom: "2026-09-02T00:00:00.000Z",
    }),
  );

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /ordinary role|ROLE|predecessor/i,
  );
});


test("rejects an observed predecessor with the correct identity but wrong assigner", () => {
  const pilotManifest = manifestForCreation();
  const observed = observerStateWithAssignment(
    pilotManifest,
    observerPredecessor(pilotManifest, {
      assignedBy: "00441000-0000-4000-8000-000000000099",
    }),
  );

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /ordinary role|ROLE|predecessor/i,
  );
});


test("rejects an observed predecessor with non-null change reason", () => {
  const pilotManifest = manifestForCreation();
  const observed = observerStateWithAssignment(
    pilotManifest,
    observerPredecessor(pilotManifest, { changeReason: "unexpected" }),
  );

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /ordinary role|ROLE|predecessor/i,
  );
});


test("accepts only the exact manifest initial PROJECT_MEMBER predecessor", () => {
  const pilotManifest = manifestForCreation();
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);
  const planned = buildPilotPreflightPlan(
    input(
      pilotManifest,
      observerStateWithAssignment(pilotManifest, observerPredecessor(pilotManifest)),
    ),
  );
  const operation = planned.operations.find(
    (candidate) => candidate.kind === "CHANGE_ORDINARY_ROLE" &&
      candidate.manifestKey === observer.key,
  );

  assert.equal(operation?.kind, "CHANGE_ORDINARY_ROLE");
  assert.deepEqual(operation?.expectedPredecessor, {
    assignmentId: observer.membership.initialRoleAssignmentId,
    projectId: pilotManifest.project.id,
    membershipId: observer.membership.id,
    role: "PROJECT_MEMBER",
    effectiveFrom: observer.membership.effectiveFrom,
    effectiveTo: observer.membership.effectiveTo,
    assignedByPersonId: observer.membership.grantedByPersonId,
    changeReason: null,
  });
});


test("plans the manifest-declared predecessor before membership exists", () => {
  const pilotManifest = manifestForCreation();
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);
  const operation = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  ).operations.find(
    (candidate) => candidate.kind === "CHANGE_ORDINARY_ROLE" &&
      candidate.manifestKey === observer.key,
  );

  assert.equal(operation?.kind, "CHANGE_ORDINARY_ROLE");
  assert.equal(
    operation?.expectedPredecessor?.assignmentId,
    observer.membership.initialRoleAssignmentId,
  );
  assert.equal(operation?.expectedPredecessor?.role, "PROJECT_MEMBER");
});


test("reuses an exact final Observer without generating a repair operation", () => {
  const pilotManifest = manifestForCreation();
  const observer = pilotManifest.users.find(
    (user) => user.role === "PROJECT_OBSERVER",
  );
  assert.ok(observer);
  const finalAssignment = observerPredecessor(pilotManifest, {
    id: observer.roleAssignmentId,
    role: "PROJECT_OBSERVER",
  });
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, observerStateWithAssignment(pilotManifest, finalAssignment)),
  );

  assert.ok(
    planned.operations.some(
      (operation) => operation.kind === "REUSE" &&
        operation.resourceKey === `role-assignment:${observer.roleAssignmentId}`,
    ),
  );
  assert.equal(
    planned.operations.some(
      (operation) => operation.kind === "CHANGE_ORDINARY_ROLE" &&
        operation.manifestKey === observer.key,
    ),
    false,
  );
});


test("rejects multiple current ordinary assignments instead of choosing one predecessor", () => {
  const pilotManifest = manifestForCreation();
  const first = observerPredecessor(pilotManifest);
  const second = observerPredecessor(pilotManifest, {
    id: "00443000-0000-4000-8000-000000000099",
    role: "PROJECT_AUDITOR",
  });
  const observed = observerStateWithAssignment(pilotManifest, first);
  observed.roleAssignments.push(second);

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, observed)),
    /overlapping ordinary role|ROLE/i,
  );
});


test("reuses exact compatible state and produces no repair operations", () => {
  const pilotManifest = manifest();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, existingState(pilotManifest)),
  );

  assert.ok(planned.operations.length > 0);
  assert.ok(planned.operations.every((operation) => operation.kind === "REUSE"));
});


test("reuses an exact observed Project without a persisted marker field", () => {
  const pilotManifest = manifest();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, existingState(pilotManifest)),
  );

  assert.ok(
    planned.operations.some(
      (operation) =>
        operation.kind === "REUSE" &&
        operation.resourceKey === `project:${pilotManifest.project.id}`,
    ),
  );
});


test("reuses an exact Project including progressPercent", () => {
  const pilotManifest = manifestWithExplicitProgress();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, existingState(pilotManifest)),
  );

  assert.ok(
    planned.operations.some(
      (operation) =>
        operation.kind === "REUSE" &&
        operation.resourceKey === `project:${pilotManifest.project.id}`,
    ),
  );
});


test("rejects a Project progressPercent mismatch", () => {
  const pilotManifest = manifestWithExplicitProgress();
  const state = existingState(pilotManifest);
  (state.projects[0] as unknown as { progressPercent: number }).progressPercent = 25;

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, state)),
    /incompatible project/i,
  );
});


test("creates an absent Project without requiring an observed marker", () => {
  const pilotManifest = manifestForCreation();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  );

  assert.ok(
    planned.operations.some(
      (operation) =>
        operation.kind === "CREATE_PROJECT" &&
        operation.id === pilotManifest.project.id,
    ),
  );
});


test("includes manifest progressPercent in the absent Project operation", () => {
  const pilotManifest = manifestWithExplicitProgress();
  for (const pilotUser of pilotManifest.users as unknown as Array<{
    person: { kind: string; displayName?: string };
  }>) {
    pilotUser.person.kind = "new";
    pilotUser.person.displayName = pilotUser.person.displayName ?? "New Person";
  }
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  );
  const createProject = planned.operations.find(
    (operation) => operation.kind === "CREATE_PROJECT",
  );

  assert.equal(
    (createProject as PilotPlanOperation & { progressPercent: number }).progressPercent,
    pilotManifest.project.progressPercent,
  );
});


test("preflight and VS004-03B use the same Project compatibility fields", () => {
  const pilotManifest = manifest();
  const project = pilotManifest.project;
  const observed: ObservedProject = {
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
  const preparationIntent: PilotProjectCreateIntent = {
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

  assert.deepEqual(
    Object.keys(observed).sort(),
    Object.keys(preparationIntent).sort(),
  );
  assert.equal("marker" in observed, false);
  assert.equal("health" in observed, false);
  assert.equal("createdAt" in observed, false);
  assert.equal("updatedAt" in observed, false);
});


test("run correlation IDs are per-run evidence and do not change manifest hash", () => {
  const pilotManifest = manifestForCreation();
  const first = buildPilotPreflightPlan(
    input(pilotManifest, emptyState()),
  );
  const second = buildPilotPreflightPlan(
    input(pilotManifest, emptyState(), {
      runCorrelationId: secondRunCorrelationId,
    }),
  );

  assert.notEqual(first.runCorrelationId, second.runCorrelationId);
  assert.equal(first.manifestHash, second.manifestHash);
});


test("fails before planning when the runtime target is unsafe or mismatched", () => {
  assert.throws(
    () => buildPilotPreflightPlan(
      input(manifest(), emptyState(), {
        runtimeTarget: {
          cadenceEnv: "local",
          supabaseUrl: "https://production.example.test",
          supabaseProjectRef: undefined,
          safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
        },
      }),
    ),
    /local requires SUPABASE_URL/,
  );

  assert.throws(
    () => buildPilotPreflightPlan(
      input(manifest(), emptyState(), {
        runtimeTarget: {
          cadenceEnv: "local",
          supabaseUrl: "http://127.0.0.1:54321",
          supabaseProjectRef: undefined,
          safeTargetMarker: "WRONG_TARGET",
        },
      }),
    ),
    /safeTargetMarker/,
  );
});


test("matching safeTargetMarker authorizes target validation independently of Project observation", () => {
  const pilotManifest = manifestForCreation();
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, emptyState(), {
      runtimeTarget: {
        cadenceEnv: "local",
        supabaseUrl: "http://127.0.0.1:54321",
        supabaseProjectRef: undefined,
        safeTargetMarker: pilotManifest.target.safeTargetMarker,
      },
    }),
  );

  assert.equal(
    planned.target.safeTargetMarker,
    pilotManifest.target.safeTargetMarker,
  );
});


test("the authoritative Projects schema has no safe-target or Project marker column", () => {
  const projectsMigration = readFileSync(
    resolve(
      __dirname,
      "../../../supabase/migrations/20260808000400_projects.sql",
    ),
    "utf8",
  );

  assert.doesNotMatch(projectsMigration, /safe_target_marker|project_marker|\bmarker\b/i);
});


test("fails contradictory identity mappings", () => {
  const state = existingState();
  state.cadenceUsers[0].personId = state.persons[2].id;
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), state)),
    /Cadence User.*wrong Person|identity/i,
  );

  const authState = existingState();
  authState.authenticationIdentities[0].personId =
    authState.persons[2].id;
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), authState)),
    /authentication identity.*wrong Person|identity/i,
  );

  const multipleIdentities = existingState();
  multipleIdentities.authenticationIdentities.push({
    ...multipleIdentities.authenticationIdentities[0],
    id: "00552000-0000-4000-8000-000000000001",
    providerSubjectId: "another-subject",
    authUserId: "another-auth-user",
    loginIdentifier: "another@example.test",
  });
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), multipleIdentities)),
    /multiple conflicting active authentication identities/i,
  );

  const duplicateProviderSubject = existingState();
  duplicateProviderSubject.authAccounts.push({
    ...duplicateProviderSubject.authAccounts[0],
    id: "00553000-0000-4000-8000-000000000001",
    loginIdentifier: "duplicate@example.test",
  });
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), duplicateProviderSubject)),
    /multiple conflicting authentication accounts/i,
  );

  const wrongExplicitIdentity = existingState();
  wrongExplicitIdentity.authenticationIdentities[0].id =
    "00552000-0000-4000-8000-000000000002";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), wrongExplicitIdentity)),
    /identity ID.*conflict|authentication identity/i,
  );

  const missingAuthAccount = existingState();
  missingAuthAccount.authAccounts.splice(0, 1);
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), missingAuthAccount)),
    /missing.*Auth account|identity.*account/i,
  );
});


test("fails incompatible project, health, owner projection, and membership state", () => {
  const projectState = existingState();
  projectState.projects[0].name = "Different project";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), projectState)),
    /incompatible project/i,
  );

  const healthState = existingState();
  healthState.projectHealth[0].status = "blocked";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), healthState)),
    /Project Health is incompatible/i,
  );

  const ownerState = existingState();
  ownerState.projects[0].ownerUserId =
    "00448000-0000-4000-8000-000000000099";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), ownerState)),
    /owner_user_id|owner projection/i,
  );

  const membershipState = existingState();
  membershipState.memberships[0].grantedByPersonId =
    "00441000-0000-4000-8000-000000000099";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), membershipState)),
    /grantor|provenance/i,
  );

  const orphanHealth = existingState();
  orphanHealth.projects.splice(0, 1);
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), orphanHealth)),
    /orphan.*Project Health|Project Health.*project/i,
  );
});


test("rejects overlapping contradictory membership and ordinary-role state", () => {
  const membershipState = existingState();
  membershipState.memberships.push({
    ...membershipState.memberships[0],
    id: "00442000-0000-4000-8000-000000000099",
    effectiveFrom: "2026-09-02T00:00:00.000Z",
  });
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), membershipState)),
    /overlapping contradictory membership/i,
  );

  const roleState = existingState();
  roleState.roleAssignments.push({
    ...roleState.roleAssignments[3],
    id: "00444000-0000-4000-8000-000000000099",
    role: "PROJECT_AUDITOR",
  });
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), roleState)),
    /contradictory overlapping ordinary role/i,
  );
});


test("protected-role appointment is first-holder only", () => {
  const exact = buildPilotPreflightPlan(
    input(manifest(), existingState()),
  );
  assert.ok(
    exact.operations
      .filter((operation) => operation.role === "PROJECT_OWNER")
      .every((operation) => operation.kind === "REUSE"),
  );

  const differentHolder = existingState();
  const ownerAssignment = differentHolder.roleAssignments.find(
    (assignment) => assignment.role === "PROJECT_OWNER",
  )!;
  ownerAssignment.id = "00444000-0000-4000-8000-000000000099";
  differentHolder.protectedTransfers[0].incomingAssignmentId =
    ownerAssignment.id;
  differentHolder.roleAssignments[0].membershipId =
    differentHolder.memberships[1].id;
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), differentHolder)),
    /different effective holder|protected role/i,
  );

  const missingLedger = existingState();
  missingLedger.protectedTransfers =
    missingLedger.protectedTransfers.filter(
      (transfer) => transfer.role !== "PROJECT_OWNER",
    );
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), missingLedger)),
    /missing.*ledger|protected role/i,
  );

  const multipleHolders = existingState();
  multipleHolders.roleAssignments.push({
    ...multipleHolders.roleAssignments[0],
    id: "00444000-0000-4000-8000-000000000098",
    membershipId: multipleHolders.memberships[1].id,
  });
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), multipleHolders)),
    /multiple effective holders/i,
  );

  const historicalHolder = existingState();
  historicalHolder.roleAssignments[0].effectiveTo =
    "2026-08-31T00:00:00.000Z";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), historicalHolder)),
    /protected.*history|first appointment/i,
  );

  const mismatchedLedger = existingState();
  mismatchedLedger.protectedTransfers[0].id =
    "00447000-0000-4000-8000-000000000099";
  assert.throws(
    () => buildPilotPreflightPlan(input(manifest(), mismatchedLedger)),
    /missing or mismatched immutable transfer ledger/i,
  );

  const bounded = boundedManifest();
  const boundedState = existingState(bounded);
  const boundedOwner = boundedState.roleAssignments.find(
    (assignment) => assignment.role === "PROJECT_OWNER",
  )!;
  boundedOwner.effectiveTo = bounded.users[0].membership.effectiveTo;
  const boundedOwnerTransfer = boundedState.protectedTransfers.find(
    (transfer) => transfer.role === "PROJECT_OWNER",
  )!;
  boundedOwnerTransfer.effectiveAt = bounded.users[0].membership.effectiveFrom;
  assert.ok(
    buildPilotPreflightPlan(input(bounded, boundedState)).operations
      .some((operation) => operation.kind === "REUSE" && operation.role === "PROJECT_OWNER"),
  );
});


test("plans safe resume from an exact compatible subset without compensation", () => {
  const pilotManifest = manifestForCreation();
  const partial = emptyState();
  partial.persons.push({
    id: pilotManifest.users[0].person.id,
    displayName: pilotManifest.users[0].person.displayName ??
      pilotManifest.users[0].displayName,
  });
  const planned = buildPilotPreflightPlan(
    input(pilotManifest, partial),
  );

  assert.ok(
    planned.operations.some(
      (operation) => operation.kind === "REUSE" &&
        operation.resourceKey === `person:${pilotManifest.users[0].person.id}`,
    ),
  );
  assert.ok(
    planned.operations.some(
      (operation) => operation.kind === "CREATE_CADENCE_USER",
    ),
  );
  assert.ok(
    planned.operations.every(
      (operation) => ![
        "DELETE",
        "TRUNCATE",
        "REWRITE_HISTORY",
        "TERMINATE_MEMBER_TO_REPAIR",
        "CLOSE_ROLE_TO_REPAIR",
        "TRANSFER_PROTECTED_ROLE_TO_REPAIR_MANIFEST",
        "UPDATE_LEGACY_FIELD",
      ].includes(operation.kind),
    ),
  );
});


test("fails contradictory partial state and never plans retained legacy-field writes", () => {
  const state = emptyState();
  const pilotManifest = manifest();
  state.persons.push({
    id: pilotManifest.users[0].person.id,
    displayName: pilotManifest.users[0].displayName,
  });
  state.memberships.push({
    id: pilotManifest.users[0].membership.id,
    projectId: pilotManifest.project.id,
    personId: pilotManifest.users[1].person.id,
    effectiveFrom: pilotManifest.users[0].membership.effectiveFrom,
    effectiveTo: null,
    status: "ACTIVE",
    grantedByPersonId: operatorPersonId,
    createdAt: pilotManifest.users[0].membership.effectiveFrom,
    legacyFields: {
      userId: "legacy-user",
      roleId: "legacy-role",
      joinedAt: "legacy-joined-at",
      status: "legacy-status",
      createdBy: "legacy-created-by",
    },
  });

  assert.throws(
    () => buildPilotPreflightPlan(input(pilotManifest, state)),
    /wrong Person|membership/i,
  );
});


test("preflight is a zero-mutation pure seam", () => {
  const pilotManifest = manifestForCreation();
  const state = emptyState();
  const before = cloneState(state);
  const planned = buildPilotPreflightPlan(input(pilotManifest, state));

  assert.deepEqual(state, before);
  assert.equal(Object.isFrozen(planned), true);
  assert.equal(Object.isFrozen(planned.operations), true);
  assert.doesNotMatch(
    readFileSync(resolve(__dirname, "vs004-preflight.ts"), "utf8"),
    /createClient|\.rpc\(|\.insert\(|\.update\(|\.delete\(/i,
  );
});
