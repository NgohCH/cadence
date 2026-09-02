import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthLookup,
} from "../src/infrastructure/auth/administrative-auth-provider";
import type {
  AuthenticationIdentity,
  CadencePerson,
} from "../src/modules/identity/identity.types";
import type {
  IdentityPilotObservationRepository,
} from "../src/modules/identity/pilot-observation.repository";
import type {
  PilotCadenceUserRecord,
} from "../src/modules/identity/pilot-preparation.types";
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
  type PilotPreflightInput,
  type ObservedPilotState,
  type PilotPreflightPlan,
  type PilotRuntimeTarget,
} from "./vs004-preflight";
import {
  preparePilotExecution,
  type ControlledPilotObservationSources,
  type ControlledPilotPreflightInput,
} from "./vs004-controlled-pilot-preflight";
import {
  computeManifestHash,
  validatePilotManifest,
} from "./vs004-pilot-manifest";


const operatorPersonId = "00441000-0000-4000-8000-000000000001";
const firstRunId = "00449000-0000-4000-8000-000000000001";


function rawManifest(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
}


function creationManifest(): Record<string, unknown> {
  const manifest = rawManifest();
  const users = manifest.users as Array<{
    person: { kind: string; displayName?: string };
  }>;
  for (const user of users) {
    user.person.kind = "new";
    user.person.displayName = user.person.displayName ?? "New Person";
  }
  return manifest;
}


function target(manifest: Record<string, unknown>): PilotRuntimeTarget {
  const declaration = (manifest.target ?? {}) as Record<string, string | null>;
  const project = manifest.project as { id?: string } | undefined;
  return Object.assign({
    cadenceEnv: declaration.environment ?? "local",
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseProjectRef: undefined,
    safeTargetMarker: declaration.safeTargetMarker!,
  }, { projectId: project?.id ?? "" }) as PilotRuntimeTarget;
}


class FakeAuthReader {
  constructor(readonly events: string[] = []) {}
  readonly calls: AdministrativeAuthLookup[] = [];
  readonly accounts: readonly AdministrativeAuthAccount[] = [];

  async findAccounts(
    input: AdministrativeAuthLookup,
  ): Promise<readonly AdministrativeAuthAccount[]> {
    this.calls.push(input);
    this.events.push(`auth:${input.loginIdentifier}`);
    return this.accounts;
  }
}


class FakeIdentityReader implements IdentityPilotObservationRepository {
  constructor(readonly events: string[] = []) {}
  readonly calls: string[] = [];
  readonly persons = new Map<string, CadencePerson>([
    [operatorPersonId, {
      id: operatorPersonId,
      displayName: "VS004 Pilot Operator",
    }],
  ]);
  readonly cadenceUsers = new Map<string, PilotCadenceUserRecord>();
  readonly identitiesByPerson = new Map<string, AuthenticationIdentity[]>();
  readonly identitiesBySubject = new Map<string, AuthenticationIdentity[]>();
  readonly identitiesById = new Map<string, AuthenticationIdentity[]>();
  failure: Error | undefined;

  async findPersonById(personId: string): Promise<CadencePerson | null> {
    this.calls.push(`person:${personId}`);
    this.events.push(`identity:person:${personId}`);
    if (this.failure) throw this.failure;
    return this.persons.get(personId) ?? null;
  }

  async findCadenceUserById(userId: string): Promise<PilotCadenceUserRecord | null> {
    this.calls.push(`cadence-user:${userId}`);
    this.events.push(`identity:cadence-user:${userId}`);
    if (this.failure) throw this.failure;
    return this.cadenceUsers.get(userId) ?? null;
  }

  async listAuthenticationIdentities(personId: string): Promise<AuthenticationIdentity[]> {
    this.calls.push(`identities-person:${personId}`);
    this.events.push(`identity:identities-person:${personId}`);
    if (this.failure) throw this.failure;
    return this.identitiesByPerson.get(personId) ?? [];
  }

  async findAuthenticationIdentitiesByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<AuthenticationIdentity[]> {
    this.calls.push(`identities-subject:${provider}:${providerSubjectId}`);
    this.events.push(`identity:identities-subject:${provider}:${providerSubjectId}`);
    if (this.failure) throw this.failure;
    return this.identitiesBySubject.get(`${provider}:${providerSubjectId}`) ?? [];
  }

  async findAuthenticationIdentitiesById(identityId: string): Promise<AuthenticationIdentity[]> {
    this.calls.push(`identities-id:${identityId}`);
    this.events.push(`identity:identities-id:${identityId}`);
    if (this.failure) throw this.failure;
    return this.identitiesById.get(identityId) ?? [];
  }
}


class FakeProjectsReader implements ProjectsPilotObservationRepository {
  constructor(readonly events: string[] = []) {}
  readonly calls: string[] = [];
  project: PilotProjectRecord | null = null;
  failure: Error | undefined;

  async findProjectById(projectId: string): Promise<PilotProjectRecord | null> {
    this.calls.push(projectId);
    this.events.push(`projects:${projectId}`);
    if (this.failure) throw this.failure;
    return this.project;
  }
}


class FakeProjectHealthReader implements ProjectHealthPilotObservationRepository {
  constructor(readonly events: string[] = []) {}
  readonly calls: string[] = [];
  health: PilotProjectHealthRecord | null = null;
  failure: Error | undefined;

  async findCurrentProjectHealth(projectId: string): Promise<PilotProjectHealthRecord | null> {
    this.calls.push(projectId);
    this.events.push(`project-health:${projectId}`);
    if (this.failure) throw this.failure;
    return this.health;
  }
}


class FakeMembershipReader implements ProjectMembershipPilotObservationRepository {
  constructor(readonly events: string[] = []) {}
  readonly calls: string[] = [];
  memberships: ProjectMembership[] = [];
  assignments = new Map<string, ProjectRoleAssignment[]>();
  transfers: ProjectRoleTransferRecord[] = [];
  failure: Error | undefined;

  async listMembershipsForProject(projectId: string): Promise<ProjectMembership[]> {
    this.calls.push(`memberships:${projectId}`);
    this.events.push(`membership:memberships:${projectId}`);
    if (this.failure) throw this.failure;
    return this.memberships;
  }

  async listRoleAssignments(membershipId: string): Promise<ProjectRoleAssignment[]> {
    this.calls.push(`assignments:${membershipId}`);
    this.events.push(`membership:assignments:${membershipId}`);
    if (this.failure) throw this.failure;
    return this.assignments.get(membershipId) ?? [];
  }

  async listProtectedRoleTransfers(projectId: string): Promise<ProjectRoleTransferRecord[]> {
    this.calls.push(`transfers:${projectId}`);
    this.events.push(`membership:transfers:${projectId}`);
    if (this.failure) throw this.failure;
    return this.transfers;
  }
}


function sources(): {
  auth: FakeAuthReader;
  identity: FakeIdentityReader;
  projects: FakeProjectsReader;
  projectHealth: FakeProjectHealthReader;
  membership: FakeMembershipReader;
  events: string[];
  typed: ControlledPilotObservationSources;
} {
  const events: string[] = [];
  const auth = new FakeAuthReader(events);
  const identity = new FakeIdentityReader(events);
  const projects = new FakeProjectsReader(events);
  const projectHealth = new FakeProjectHealthReader(events);
  const membership = new FakeMembershipReader(events);
  return {
    auth,
    identity,
    projects,
    projectHealth,
    membership,
    events,
    typed: { auth, identity, projects, projectHealth, membership },
  };
}


function input(
  manifest: unknown = creationManifest(),
  overrides: Partial<ControlledPilotPreflightInput> = {},
): ControlledPilotPreflightInput {
  const manifestRecord = manifest as Record<string, unknown>;
  return {
    manifest,
    runtimeTarget: target(manifestRecord),
    runCorrelationId: firstRunId,
    ...overrides,
  };
}


test("valid input reaches read-only observation", async () => {
  const setup = sources();
  const result = await preparePilotExecution(input(), setup.typed);

  assert.equal(result.manifestId, "vs004-default-m1-pilot");
  assert.ok(setup.identity.calls.length > 0);
  assert.equal(setup.projects.calls.length, 1);
});


test("invalid manifest fails before any observation", async () => {
  const setup = sources();

  await assert.rejects(
    preparePilotExecution(input({}), setup.typed),
    (error: Error) => /INPUT|manifest/i.test(error.message),
  );
  assert.equal(setup.identity.calls.length, 0);
  assert.equal(setup.projects.calls.length, 0);
  assert.equal(setup.projectHealth.calls.length, 0);
  assert.equal(setup.membership.calls.length, 0);
});


test("unsafe environment fails before authoritative reads", async () => {
  const setup = sources();

  await assert.rejects(
    preparePilotExecution(
      input(creationManifest(), {
        runtimeTarget: {
          cadenceEnv: "local",
          supabaseUrl: "https://not-local.example.test",
          supabaseProjectRef: undefined,
          projectId: (creationManifest() as { project: { id: string } }).project.id,
          safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
        },
      }),
      setup.typed,
    ),
    /TARGET|local requires SUPABASE_URL/i,
  );
  assert.equal(setup.identity.calls.length, 0);
  assert.equal(setup.projects.calls.length, 0);
});


test("Supabase project-reference mismatch fails before authoritative reads", async () => {
  const setup = sources();

  await assert.rejects(
    preparePilotExecution(
      input(creationManifest(), {
        runtimeTarget: {
          cadenceEnv: "qa",
          supabaseUrl: "https://declared-ref.supabase.co",
          supabaseProjectRef: "declared-ref",
          projectId: (creationManifest() as { project: { id: string } }).project.id,
          safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
        },
      }),
      setup.typed,
    ),
    (error: unknown) => {
      assert.equal((error as { category: string }).category, "TARGET");
      return true;
    },
  );
  assert.equal(setup.identity.calls.length, 0);
  assert.equal(setup.projects.calls.length, 0);
});


test("safeTargetMarker mismatch fails before Project observation", async () => {
  const setup = sources();

  await assert.rejects(
    preparePilotExecution(
      input(creationManifest(), {
        runtimeTarget: {
          ...target(creationManifest()),
          safeTargetMarker: "WRONG_TARGET",
        },
      }),
      setup.typed,
    ),
    /safeTargetMarker|TARGET/i,
  );
  assert.equal(setup.projects.calls.length, 0);
});


test("runtime Project target mismatch fails before observation and planning", async () => {
  const setup = sources();
  const pilotManifest = creationManifest();
  const runtimeTarget = Object.assign(target(pilotManifest), {
    projectId: "00440000-0000-4000-8000-000000000099",
  }) as PilotRuntimeTarget;

  await assert.rejects(
    preparePilotExecution(
      input(pilotManifest, { runtimeTarget }),
      setup.typed,
    ),
    (error: unknown) => {
      assert.equal((error as { category: string }).category, "TARGET");
      return true;
    },
  );
  assert.equal(setup.events.length, 0);
});


test("all authoritative state is read before the planner is invoked", async () => {
  const setup = sources();
  const planner = (plannerInput: PilotPreflightInput): PilotPreflightPlan => {
    setup.events.push("plan");
    assert.equal(plannerInput.observed.projects.length, 0);
    assert.equal(plannerInput.observed.projectHealth.length, 0);
    return buildPilotPreflightPlan(plannerInput);
  };
  const originalCalls = [
    setup.identity,
    setup.projects,
    setup.projectHealth,
    setup.membership,
  ];
  for (const reader of originalCalls) {
    const original = reader.calls.push.bind(reader.calls);
    reader.calls.push = (...items: string[]) => {
      setup.events.push(`${reader.constructor.name}:${items[0]}`);
      return original(...items);
    };
  }

  await preparePilotExecution(input(), setup.typed, planner);

  assert.equal(setup.events.at(-1), "plan");
  assert.ok(setup.events.some((event) => event.startsWith("FakeIdentityReader:")));
  assert.ok(setup.events.some((event) => event.startsWith("FakeProjectsReader:")));
  assert.ok(setup.events.some((event) => event.startsWith("FakeProjectHealthReader:")));
  assert.ok(setup.events.some((event) => event.startsWith("FakeMembershipReader:")));
});


test("all intended users and provider subjects are observed before planning", async () => {
  const setup = sources();
  let plannerCalls = 0;
  const result = await preparePilotExecution(input(), setup.typed, (plannerInput) => {
    plannerCalls += 1;
    return buildPilotPreflightPlan(plannerInput);
  });

  assert.equal(plannerCalls, 1);
  assert.equal(setup.auth.calls.length, 5);
  assert.equal(
    setup.identity.calls.filter((call) => call.startsWith("identities-subject:")).length,
    5,
  );
  assert.equal(result.observedEvidence.userCount, 5);
});


test("project, health, memberships, assignments, and protected history use read-only owner ports", async () => {
  const setup = sources();
  const membership: ProjectMembership = {
    id: "00442000-0000-4000-8000-000000000002",
    projectId: "00440000-0000-4000-8000-000000000001",
    personId: "00441000-0000-4000-8000-000000000002",
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    effectiveTo: null,
    status: "ACTIVE",
    grantedBy: operatorPersonId,
    createdAt: "2026-09-01T00:00:00.000Z",
    terminationReason: null,
  };
  setup.membership.memberships = [membership];
  setup.membership.assignments.set(membership.id, [{
    id: "00444000-0000-4000-8000-000000000002",
    projectId: membership.projectId,
    membershipId: membership.id,
    role: "PROJECT_OWNER",
    effectiveFrom: membership.effectiveFrom,
    effectiveTo: null,
    assignedBy: operatorPersonId,
    changeReason: "pilot",
    createdAt: membership.createdAt,
  }]);

  const result = await preparePilotExecution(input(), setup.typed, (plannerInput) => ({
    manifestId: plannerInput.manifest.manifestId,
    manifestHash: "planner-result",
    target: {
      environment: plannerInput.manifest.target.environment,
      projectId: plannerInput.manifest.project.id,
      safeTargetMarker: plannerInput.manifest.target.safeTargetMarker,
    },
    operatorPersonId: plannerInput.manifest.operator.personId,
    runCorrelationId: plannerInput.runCorrelationId,
    operations: [],
  }));

  assert.equal(setup.projects.calls.length, 1);
  assert.equal(setup.projectHealth.calls.length, 1);
  assert.deepEqual(setup.membership.calls, [
    `memberships:${membership.projectId}`,
    `assignments:${membership.id}`,
    `transfers:${membership.projectId}`,
  ]);
  assert.equal(result.observedEvidence.membershipCount, 1);
  assert.equal(result.observedEvidence.roleAssignmentCount, 1);
});


test("an Identity observation failure prevents planner invocation and executable output", async () => {
  const setup = sources();
  setup.identity.failure = new Error("provider secret must not escape");
  let plannerCalls = 0;

  await assert.rejects(
    preparePilotExecution(input(), setup.typed, () => {
      plannerCalls += 1;
      throw new Error("planner must not run");
    }),
    (error: unknown) => {
      assert.equal((error as { category: string }).category, "IDENTITY_OBSERVATION");
      assert.doesNotMatch((error as Error).message, /secret/);
      return true;
    },
  );
  assert.equal(plannerCalls, 0);
});


for (const [label, property, category] of [
  ["Project", "projects", "PROJECT_OBSERVATION"],
  ["Project Health", "projectHealth", "PROJECT_HEALTH_OBSERVATION"],
  ["Membership", "membership", "MEMBERSHIP_OBSERVATION"],
] as const) {
  test(`${label} observation failure prevents planner invocation`, async () => {
    const setup = sources();
    setup[property].failure = new Error("read failure");
    let plannerCalls = 0;

    await assert.rejects(
      preparePilotExecution(input(), setup.typed, () => {
        plannerCalls += 1;
        throw new Error("planner must not run");
      }),
      (error: unknown) => {
        assert.equal((error as { category: string }).category, category);
        return true;
      },
    );
    assert.equal(plannerCalls, 0);
  });
}


test("malformed observed Project state fails before planning", async () => {
  const setup = sources();
  setup.projects.project = {
    id: "00440000-0000-4000-8000-000000000001",
    name: "VS004 Controlled Pilot Project",
    description: "Safe VS004 pilot example.",
    goal: "Exercise controlled project access.",
    lifecycleStatus: "active",
    progressPercent: Number.NaN,
    ownerUserId: "00448000-0000-4000-8000-000000000002",
    startDate: "2026-09-01",
    targetDate: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  let plannerCalls = 0;

  await assert.rejects(
    preparePilotExecution(input(), setup.typed, () => {
      plannerCalls += 1;
      throw new Error("planner must not run");
    }),
    (error: unknown) => {
      assert.equal((error as { category: string }).category, "PROJECT_OBSERVATION");
      return true;
    },
  );
  assert.equal(plannerCalls, 0);
});


test("the existing pure planner is invoked exactly once and its CREATE plan is preserved", async () => {
  const setup = sources();
  let plannerCalls = 0;
  const result = await preparePilotExecution(input(), setup.typed, (plannerInput) => {
    plannerCalls += 1;
    return buildPilotPreflightPlan(plannerInput);
  });

  assert.equal(plannerCalls, 1);
  assert.ok(result.preflightPlan.operations.some((operation) => operation.kind === "CREATE_PROJECT"));
  assert.ok(result.preflightPlan.operations.some((operation) => operation.kind === "CREATE_PERSON"));
});


test("planner REUSE operations are preserved and planner conflicts fail closed", async () => {
  const setup = sources();
  const reusePlan: PilotPreflightPlan = {
    manifestId: "vs004-default-m1-pilot",
    manifestHash: "planner-hash",
    target: {
      environment: "local",
      projectId: "00440000-0000-4000-8000-000000000001",
      safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
    },
    operatorPersonId,
    runCorrelationId: firstRunId,
    operations: [{
      kind: "REUSE",
      resourceKey: "project:00440000-0000-4000-8000-000000000001",
      id: "00440000-0000-4000-8000-000000000001",
    }],
  };
  const result = await preparePilotExecution(input(), setup.typed, () => reusePlan);
  assert.deepEqual(result.preflightPlan.operations, reusePlan.operations);

  await assert.rejects(
    preparePilotExecution(input(), sources().typed, () => {
      throw new Error("incompatible project");
    }),
    (error: unknown) => {
      assert.equal((error as { category: string }).category, "PREFLIGHT_CONFLICT");
      return true;
    },
  );
});


test("PreparedPilotExecution retains the validated manifest hash independent of planner output", async () => {
  const manifest = validatePilotManifest(creationManifest());
  const result = await preparePilotExecution(
    input(manifest),
    sources().typed,
    (plannerInput) => buildPilotPreflightPlan(plannerInput),
  );

  assert.equal(result.manifestHash, computeManifestHash(manifest));
  assert.equal(result.validatedManifest.manifestId, manifest.manifestId);
});


test("generated run correlation IDs differ across preparations and remain bound within one result", async () => {
  const first = await preparePilotExecution(
    input(creationManifest(), { runCorrelationId: undefined }),
    sources().typed,
    (plannerInput) => buildPilotPreflightPlan(plannerInput),
  );
  const second = await preparePilotExecution(
    input(creationManifest(), { runCorrelationId: undefined }),
    sources().typed,
    (plannerInput) => buildPilotPreflightPlan(plannerInput),
  );

  assert.match(first.runCorrelationId, /^[0-9a-f-]{36}$/i);
  assert.notEqual(first.runCorrelationId, second.runCorrelationId);
  assert.equal(first.preflightPlan.runCorrelationId, first.runCorrelationId);
});


test("PreparedPilotExecution is frozen, target-bound, and credential-free", async () => {
  const result = await preparePilotExecution(input(), sources().typed);

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.preflightPlan));
  assert.equal(result.target.safeTargetMarker, "VS004_LOCAL_PILOT_TARGET");
  assert.equal(result.operatorPersonId, operatorPersonId);
  assert.doesNotMatch(JSON.stringify(result), /password|secret|token|service-role/i);
});


test("observation dependencies expose no mutation capability", () => {
  const setup = sources();
  const readOnly = setup.typed;

  assert.equal("createPerson" in readOnly.identity, false);
  assert.equal("createCadenceUser" in readOnly.identity, false);
  assert.equal("createProject" in readOnly.projects, false);
  assert.equal("createCurrentProjectHealth" in readOnly.projectHealth, false);
  assert.equal("createMembership" in readOnly.membership, false);
  assert.equal("transferProtectedRole" in readOnly.membership, false);
});
