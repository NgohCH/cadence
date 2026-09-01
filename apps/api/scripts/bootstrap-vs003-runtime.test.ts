import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type FixtureModule = {
  VS003_RUNTIME_FIXTURE: {
    actors: Record<
      string,
      {
        key: string;
        email: string;
        username: string;
        displayName: string;
        personId: string;
        userId: string;
        p1Role: string | null;
        p2Role: string | null;
      }
    >;
    projects: {
      p1: { id: string; ownerUserId: string; marker: string };
      p2: { id: string; ownerUserId: string; marker: string };
    };
  };
  assertVs003LocalEnvironment: (input: {
    cadenceEnv: string | undefined;
    supabaseUrl: string | undefined;
    supabaseProjectRef: string | undefined;
  }) => void;
  planMembershipReconciliation: (input: {
    membershipExists: boolean;
    currentRole: string | null;
    targetRole: string;
  }) => string[];
  assertDeterministicIdentity: (
    existing: {
      id: string;
      authUserId: string;
      personId: string;
      provider: string;
      providerSubjectId: string;
      loginIdentifier: string;
      validFrom: string;
      validTo: string | null;
      status: string;
    },
    expected: {
      id: string;
      authUserId: string;
      personId: string;
      provider: string;
      providerSubjectId: string;
      loginIdentifier: string;
      validFrom: string;
      validTo: string | null;
      status: string;
    },
  ) => void;
  assertDeterministicProject: (
    existing: { id: string; marker: string },
    expected: { id: string; marker: string },
  ) => void;
  planProjectHealthReconciliation: (existing: {
    healthStatus: string;
    reasons: unknown;
    source: string;
    changedBy: string | null;
  } | null) => string;
  assertAssignmentHistoryExact: (
    actual: readonly Record<string, unknown>[],
    expected: readonly Record<string, unknown>[],
  ) => void;
  assertVs003DomainEventsExact: (
    actual: readonly Record<string, unknown>[],
    expected: readonly Record<string, unknown>[],
  ) => void;
  assertDeterministicProjectState: (
    existing: Record<string, unknown>,
    expected: Record<string, unknown>,
  ) => void;
  assertDeterministicProjectHealth: (
    existing: Record<string, unknown>,
    expected: Record<string, unknown>,
  ) => void;
  assertVs003LocalPasswords: (
    passwords: Record<string, string | undefined>,
  ) => void;
  ensureMembershipWithStore: (
    store: MembershipStore,
    spec: MembershipSpec,
  ) => Promise<void>;
  ensureAuthenticationIdentity: (
    admin: unknown,
    actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string],
    authUserId: string,
  ) => Promise<void>;
  preflightFixtureActors: (
    store: ActorPreflightStore,
  ) => Promise<void>;
  reconcileFixtureActors: (
    store: ActorPreflightStore,
    reconcileActor: (actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string]) => Promise<void>,
  ) => Promise<void>;
  reconcileFixtureMembershipsWithStore: (
    store: MembershipStore,
  ) => Promise<void>;
  VS003_RUNTIME_MEMBERSHIP_SPECS: readonly MembershipSpec[];
  expectedAssignmentHistory: (
    spec: MembershipSpec,
    includeReplacement: boolean,
  ) => Record<string, unknown>[];
  expectedVs003Events: () => Record<string, unknown>[];
};

type MembershipSpec = {
  membershipId: string;
  initialAssignmentId: string;
  targetAssignmentId: string | null;
  correlationId: string;
  roleChangeCorrelationId: string | null;
  projectId: string;
  personId: string;
  grantorPersonId: string;
  targetRole: string;
};

type MembershipStore = {
  readMembership: (spec: MembershipSpec) => Promise<Record<string, unknown> | null>;
  readAssignments: (spec: MembershipSpec) => Promise<Record<string, unknown>[]>;
  readEvents: (spec: MembershipSpec) => Promise<Record<string, unknown>[]>;
  addProjectMember: (spec: MembershipSpec) => Promise<void>;
  changeOrdinaryRole: (spec: MembershipSpec) => Promise<void>;
};

type ActorPreflightStore = {
  readAuthUser: (actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string]) => Promise<{ id: string } | null>;
  readActiveIdentities: (actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string]) => Promise<Record<string, unknown>[]>;
  readPerson: (actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string]) => Promise<Record<string, unknown> | null>;
  readCadenceUser: (actor: FixtureModule["VS003_RUNTIME_FIXTURE"]["actors"][string], authUserId: string | null) => Promise<Record<string, unknown> | null>;
  authMutations: string[];
};

async function loadFixtureModule(): Promise<FixtureModule> {
  try {
    return (await import("./bootstrap-vs003-runtime.js")) as unknown as FixtureModule;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND"
    ) {
      assert.fail(
        "VS003 runtime fixture behavior is not implemented yet.",
      );
    }

    throw error;
  }
}

function actorPreflightStore(
  fixture: FixtureModule,
  options: {
    duplicateActorKey?: string;
    contradictoryActorKey?: string;
  } = {},
): ActorPreflightStore & { mutations: string[] } {
  const mutations: string[] = [];
  const store: ActorPreflightStore = {
    authMutations: mutations,
    readAuthUser: async (actor) => ({ id: `auth-${actor.userId}` }),
    readActiveIdentities: async (actor) => {
      const identity = {
        id: `auth-${actor.userId}`,
        person_id: actor.personId,
        provider: "local",
        provider_subject_id: `auth-${actor.userId}`,
        login_identifier: actor.email,
        valid_from: "2026-01-01T00:00:00.000Z",
        valid_to: null,
        status: "ACTIVE",
      };
      if (actor.key === options.duplicateActorKey) {
        return [identity, { ...identity, id: `${identity.id}-duplicate` }];
      }
      if (actor.key === options.contradictoryActorKey) {
        return [{ ...identity, provider_subject_id: "wrong-auth" }];
      }
      return [identity];
    },
    readPerson: async (actor) => ({
      id: actor.personId,
      display_name: actor.displayName,
    }),
    readCadenceUser: async (actor, authUserId) => ({
      id: actor.userId,
      auth_user_id: authUserId,
      person_id: actor.personId,
      username: actor.username,
      display_name: actor.displayName,
      email: actor.email,
      status: "active",
      identity_provider: "local",
    }),
  };
  void fixture;
  return { ...store, mutations };
}

test("actor A duplicate identity blocks all Auth mutation", async () => {
  const fixture = await loadFixtureModule();
  const store = actorPreflightStore(fixture, { duplicateActorKey: "userA" });

  await assert.rejects(() => fixture.reconcileFixtureActors(store, async (actor) => {
    store.mutations.push(`auth-update:${actor.key}`);
  }), /multiple active authentication identities/i);
  assert.deepEqual(store.mutations, []);
});

test("last actor duplicate identity blocks Auth mutation for every actor", async () => {
  const fixture = await loadFixtureModule();
  const store = actorPreflightStore(fixture, { duplicateActorKey: "nonmember" });

  await assert.rejects(() => fixture.reconcileFixtureActors(store, async (actor) => {
    store.mutations.push(`auth-update:${actor.key}`);
  }), /multiple active authentication identities/i);
  assert.deepEqual(store.mutations, []);
});

test("contradictory identity linkage blocks all Auth mutation", async () => {
  const fixture = await loadFixtureModule();
  const store = actorPreflightStore(fixture, { contradictoryActorKey: "observer" });

  await assert.rejects(() => fixture.reconcileFixtureActors(store, async (actor) => {
    store.mutations.push(`auth-update:${actor.key}`);
  }), /conflicting deterministic identity/i);
  assert.deepEqual(store.mutations, []);
});

test("all five valid actors complete read-only preflight", async () => {
  const fixture = await loadFixtureModule();
  const store = actorPreflightStore(fixture);

  await fixture.reconcileFixtureActors(store, async (actor) => {
    store.mutations.push(`auth-update:${actor.key}`);
  });
  assert.equal(store.mutations.length, 5);
});

function requireValidator(
  fixture: FixtureModule,
  name: keyof FixtureModule,
): (...args: any[]) => any {
  const validator = fixture[name];
  if (typeof validator !== "function") {
    throw new Error(`VS003 runtime validator ${String(name)} is not implemented.`);
  }
  return validator as (...args: any[]) => any;
}

test("rejects non-local Cadence environment", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.assertVs003LocalEnvironment({
        cadenceEnv: "beta",
        supabaseUrl: "http://127.0.0.1:54321",
        supabaseProjectRef: undefined,
      }),
    /CADENCE_ENV=local/,
  );
});

test("rejects hosted Supabase URLs", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.assertVs003LocalEnvironment({
        cadenceEnv: "local",
        supabaseUrl: "https://hosted.supabase.co",
        supabaseProjectRef: undefined,
      }),
    /SUPABASE_URL/,
  );
});

test("defines the five deterministic VS003 actors", async () => {
  const fixture = await loadFixtureModule();
  const actors = fixture.VS003_RUNTIME_FIXTURE.actors;

  assert.deepEqual(
    Object.keys(actors).sort(),
    ["auditor", "nonmember", "observer", "userA", "userB"].sort(),
  );

  assert.equal(actors.userA.email, "vs003.user-a@cadence.test");
  assert.equal(actors.userB.email, "vs003.user-b@cadence.test");
  assert.equal(actors.observer.email, "vs003.observer@cadence.test");
  assert.equal(actors.auditor.email, "vs003.auditor@cadence.test");
  assert.equal(actors.nonmember.email, "vs003.nonmember@cadence.test");

  assert.equal(
    actors.userA.personId,
    "00330000-0000-4000-8000-000000000001",
  );
  assert.equal(
    actors.auditor.userId,
    "00331000-0000-4000-8000-000000000004",
  );
});

test("defines the approved P1 and P2 topology", async () => {
  const fixture = await loadFixtureModule();
  const { actors, projects } = fixture.VS003_RUNTIME_FIXTURE;

  assert.equal(
    projects.p1.id,
    "00332000-0000-4000-8000-000000000001",
  );
  assert.equal(
    projects.p2.id,
    "00332000-0000-4000-8000-000000000002",
  );
  assert.equal(projects.p1.ownerUserId, actors.userA.userId);
  assert.equal(projects.p2.ownerUserId, actors.userB.userId);
  assert.match(projects.p1.marker, /VS003 LOCAL/);
  assert.match(projects.p2.marker, /VS003 LOCAL/);

  assert.equal(actors.userA.p1Role, "PROJECT_MEMBER");
  assert.equal(actors.userB.p1Role, "PROJECT_MEMBER");
  assert.equal(actors.observer.p1Role, "PROJECT_OBSERVER");
  assert.equal(actors.auditor.p1Role, "PROJECT_AUDITOR");
  assert.equal(actors.nonmember.p1Role, null);

  assert.equal(actors.userA.p2Role, null);
  assert.equal(actors.userB.p2Role, "PROJECT_MEMBER");
  assert.equal(actors.observer.p2Role, null);
  assert.equal(actors.auditor.p2Role, null);
  assert.equal(actors.nonmember.p2Role, null);
});

test("plans no membership operation for the nonmember", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: false,
      currentRole: null,
      targetRole: "NONE",
    }),
    [],
  );
});

test("plans Observer as an ordinary-role replacement", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: true,
      currentRole: "PROJECT_MEMBER",
      targetRole: "PROJECT_OBSERVER",
    }),
    ["change_project_ordinary_role"],
  );
});

test("plans Auditor as an ordinary-role replacement", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: true,
      currentRole: "PROJECT_MEMBER",
      targetRole: "PROJECT_AUDITOR",
    }),
    ["change_project_ordinary_role"],
  );
});

test("plans canonical admission for an absent member", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: false,
      currentRole: null,
      targetRole: "PROJECT_MEMBER",
    }),
    ["add_project_member"],
  );
});

test("does not plan duplicate admission for a converged member", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: true,
      currentRole: "PROJECT_MEMBER",
      targetRole: "PROJECT_MEMBER",
    }),
    [],
  );
});

test("does not plan duplicate role change for a converged Observer", async () => {
  const fixture = await loadFixtureModule();

  assert.deepEqual(
    fixture.planMembershipReconciliation({
      membershipExists: true,
      currentRole: "PROJECT_OBSERVER",
      targetRole: "PROJECT_OBSERVER",
    }),
    [],
  );
});

test("fails closed for a conflicting deterministic identity", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.assertDeterministicIdentity(
        {
          id: "unexpected-user-id",
          authUserId: "auth-a",
          personId: "00330000-0000-4000-8000-000000000001",
          provider: "local",
          providerSubjectId: "auth-a",
          loginIdentifier: "vs003.user-a@cadence.test",
          validFrom: "2026-01-01T00:00:00+00:00",
          validTo: null,
          status: "ACTIVE",
        },
        {
          id: "00331000-0000-4000-8000-000000000001",
          authUserId: "auth-a",
          personId: "00330000-0000-4000-8000-000000000001",
          provider: "local",
          providerSubjectId: "auth-a",
          loginIdentifier: "vs003.user-a@cadence.test",
          validFrom: "2026-01-01T00:00:00.000Z",
          validTo: null,
          status: "ACTIVE",
        },
      ),
    /conflicting deterministic identity/,
  );
});

test("accepts equivalent authentication-identity timestamp encodings", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00+00:00",
    validTo: null,
    status: "ACTIVE",
  };

  assert.doesNotThrow(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validFrom: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("accepts equivalent non-zero offset authentication-identity timestamps", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T08:00:00+08:00",
    validTo: null,
    status: "ACTIVE",
  };

  assert.doesNotThrow(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validFrom: "2026-01-01T00:00:00.000Z",
    }),
  );
});

test("rejects a timezone-less timestamp instead of accepting generic Date syntax", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00",
    validTo: null,
    status: "ACTIVE",
  };

  assert.throws(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validFrom: "2026-01-01T00:00:00.000Z",
    }),
    /conflicting deterministic identity/,
  );
});

test("rejects date-only, locale-style, malformed, impossible, and invalid-offset timestamps", async () => {
  const fixture = await loadFixtureModule();
  const invalidValues = [
    "2026-01-01",
    "01/01/2026 00:00:00",
    "January 1 2026",
    "2026-01-01T00:00:00.000Zgarbage",
    "2026-02-30T00:00:00.000Z",
    "2026-01-01T00:00:00+24:00",
  ];

  for (const validFrom of invalidValues) {
    assert.throws(
      () => fixture.assertDeterministicIdentity(
        {
          id: "auth-a",
          authUserId: "auth-a",
          personId: "00330000-0000-4000-8000-000000000001",
          provider: "local",
          providerSubjectId: "auth-a",
          loginIdentifier: "vs003.user-a@cadence.test",
          validFrom,
          validTo: null,
          status: "ACTIVE",
        },
        {
          id: "auth-a",
          authUserId: "auth-a",
          personId: "00330000-0000-4000-8000-000000000001",
          provider: "local",
          providerSubjectId: "auth-a",
          loginIdentifier: "vs003.user-a@cadence.test",
          validFrom: "2026-01-01T00:00:00.000Z",
          validTo: null,
          status: "ACTIVE",
        },
      ),
      /conflicting deterministic identity/,
      validFrom,
    );
  }
});

test("preserves nullable timestamp equality behavior", async () => {
  const fixture = await loadFixtureModule();
  const base = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
  };

  assert.doesNotThrow(() => fixture.assertDeterministicIdentity(
    { ...base, validTo: null },
    { ...base, validTo: null },
  ));
  assert.throws(() => fixture.assertDeterministicIdentity(
    { ...base, validTo: null },
    { ...base, validTo: "2026-02-01T00:00:00.000Z" },
  ), /conflicting deterministic identity/);
  assert.throws(() => fixture.assertDeterministicIdentity(
    { ...base, validTo: "2026-02-01T00:00:00.000Z" },
    { ...base, validTo: null },
  ), /conflicting deterministic identity/);
});

test("rejects a genuinely different authentication-identity valid_from", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:01+00:00",
    validTo: null,
    status: "ACTIVE",
  };

  assert.throws(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validFrom: "2026-01-01T00:00:00.000Z",
    }),
    /conflicting deterministic identity/,
  );
});

test("rejects a non-timestamp authentication-identity mismatch", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "different-auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00+00:00",
    validTo: null,
    status: "ACTIVE",
  };

  assert.throws(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      providerSubjectId: "auth-a",
    }),
    /conflicting deterministic identity/,
  );
});

test("accepts equivalent non-null authentication-identity valid_to encodings", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00+00:00",
    validTo: "2026-02-01T00:00:00+00:00",
    status: "ACTIVE",
  };

  assert.doesNotThrow(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validTo: "2026-02-01T00:00:00.000Z",
    }),
  );
});

test("requires null authentication-identity valid_to when expected null", async () => {
  const fixture = await loadFixtureModule();
  const identity = {
    id: "auth-a",
    authUserId: "auth-a",
    personId: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    providerSubjectId: "auth-a",
    loginIdentifier: "vs003.user-a@cadence.test",
    validFrom: "2026-01-01T00:00:00+00:00",
    validTo: "2026-02-01T00:00:00+00:00",
    status: "ACTIVE",
  };

  assert.throws(() =>
    fixture.assertDeterministicIdentity(identity, {
      ...identity,
      validTo: null,
    }),
    /conflicting deterministic identity/,
  );
});

function identityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "auth-a",
    person_id: "00330000-0000-4000-8000-000000000001",
    provider: "local",
    provider_subject_id: "auth-a",
    login_identifier: "vs003.user-a@cadence.test",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
    status: "ACTIVE",
    ...overrides,
  };
}

function identityStore(rows: Record<string, unknown>[]) {
  const mutations: string[] = [];
  const query = {
    select() { return query; },
    eq() { return query; },
    then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
      return resolve({ data: rows, error: null });
    },
    insert() {
      mutations.push("insert");
      return Promise.resolve({ error: null });
    },
  };
  return {
    admin: { from: () => query },
    mutations,
  };
}

test("creates the deterministic identity when no active identity exists", async () => {
  const fixture = await loadFixtureModule();
  const store = identityStore([]);

  await fixture.ensureAuthenticationIdentity(
    store.admin,
    fixture.VS003_RUNTIME_FIXTURE.actors.userA,
    "auth-a",
  );

  assert.deepEqual(store.mutations, ["insert"]);
});

test("reuses exactly one matching active identity", async () => {
  const fixture = await loadFixtureModule();
  const store = identityStore([identityRow()]);

  await fixture.ensureAuthenticationIdentity(
    store.admin,
    fixture.VS003_RUNTIME_FIXTURE.actors.userA,
    "auth-a",
  );

  assert.deepEqual(store.mutations, []);
});

test("fails closed for two identical active identities without mutation", async () => {
  const fixture = await loadFixtureModule();
  const row = identityRow();
  const store = identityStore([row, { ...row, id: "auth-a-duplicate" }]);

  await assert.rejects(
    fixture.ensureAuthenticationIdentity(
      store.admin,
      fixture.VS003_RUNTIME_FIXTURE.actors.userA,
      "auth-a",
    ),
    /multiple active authentication identities|conflicting active authentication identity/i,
  );

  assert.deepEqual(store.mutations, []);
});

test("fails closed for two active identities when one conflicts", async () => {
  const fixture = await loadFixtureModule();
  const store = identityStore([
    identityRow(),
    identityRow({ id: "auth-b", provider_subject_id: "auth-b" }),
  ]);

  await assert.rejects(
    fixture.ensureAuthenticationIdentity(
      store.admin,
      fixture.VS003_RUNTIME_FIXTURE.actors.userA,
      "auth-a",
    ),
    /multiple active authentication identities|conflicting active authentication identity/i,
  );

  assert.deepEqual(store.mutations, []);
});

test("retains strict reconciliation for one conflicting active identity", async () => {
  const fixture = await loadFixtureModule();
  const store = identityStore([identityRow({ login_identifier: "wrong@example.com" })]);

  await assert.rejects(
    fixture.ensureAuthenticationIdentity(
      store.admin,
      fixture.VS003_RUNTIME_FIXTURE.actors.userA,
      "auth-a",
    ),
    /conflicting deterministic identity/,
  );

  assert.deepEqual(store.mutations, []);
});

test("fails closed for a conflicting deterministic project", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.assertDeterministicProject(
        {
          id: "00332000-0000-4000-8000-000000000001",
          marker: "unrelated project",
        },
        {
          id: "00332000-0000-4000-8000-000000000001",
          marker: "[VS003 LOCAL] Shared Discussion Project",
        },
      ),
    /conflicting deterministic project/,
  );
});

test("plans creation of the approved project-health baseline", async () => {
  const fixture = await loadFixtureModule();

  assert.equal(
    fixture.planProjectHealthReconciliation(null),
    "create",
  );
});

test("reuses an exact project-health baseline on rerun", async () => {
  const fixture = await loadFixtureModule();

  assert.equal(
    fixture.planProjectHealthReconciliation({
      healthStatus: "on_track",
      reasons: [],
      source: "system",
      changedBy: null,
    }),
    "reuse",
  );
});

test("fails closed for conflicting project-health state", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.planProjectHealthReconciliation({
        healthStatus: "blocked",
        reasons: [],
        source: "system",
        changedBy: null,
      }),
    /conflicting project-health state/,
  );
});

test("keeps the fixture boundary local-only", async () => {
  const fixture = await loadFixtureModule();

  assert.throws(
    () =>
      fixture.assertVs003LocalEnvironment({
        cadenceEnv: "local",
        supabaseUrl: "http://127.0.0.1:54321",
        supabaseProjectRef: "hosted-project-ref",
      }),
    /must not be set/,
  );
});

const orchestrationSpec: MembershipSpec = {
  membershipId: "00333000-0000-4000-8000-000000000003",
  initialAssignmentId: "00334000-0000-4000-8000-000000000003",
  targetAssignmentId: "00335000-0000-4000-8000-000000000001",
  correlationId: "00336000-0000-4000-8000-000000000003",
  roleChangeCorrelationId: "00337000-0000-4000-8000-000000000001",
  projectId: "00332000-0000-4000-8000-000000000001",
  personId: "00330000-0000-4000-8000-000000000003",
  grantorPersonId: "00330000-0000-4000-8000-000000000001",
  targetRole: "PROJECT_OBSERVER",
};

const orchestrationMembership = () => ({
  id: orchestrationSpec.membershipId,
  project_id: orchestrationSpec.projectId,
  person_id: orchestrationSpec.personId,
  effective_from: "2026-01-01T00:00:00.000Z",
  effective_to: null,
  membership_status: "ACTIVE",
  granted_by_person_id: orchestrationSpec.grantorPersonId,
});

const orchestrationAssignment = (replacement = false) => ({
  id: replacement
    ? orchestrationSpec.targetAssignmentId
    : orchestrationSpec.initialAssignmentId,
  project_id: orchestrationSpec.projectId,
  membership_id: orchestrationSpec.membershipId,
  role: replacement ? orchestrationSpec.targetRole : "PROJECT_MEMBER",
  effective_from: replacement
    ? "2026-01-01T01:00:00.000Z"
    : "2026-01-01T00:00:00.000Z",
  effective_to: replacement ? null : "2026-01-01T01:00:00.000Z",
  assigned_by_person_id: orchestrationSpec.grantorPersonId,
  change_reason: replacement
    ? "VS003 local runtime fixture role shape"
    : null,
  created_at: replacement
    ? "2026-01-01T01:00:00.000Z"
    : "2026-01-01T00:00:00.000Z",
});

const orchestrationEvent = (
  eventType: string,
  correlationId: string,
  payload: Record<string, unknown>,
  id: string,
) => ({
  id,
  event_type: eventType,
  event_version: 1,
  aggregate_type: "project_membership",
  aggregate_id: orchestrationSpec.membershipId,
  project_id: orchestrationSpec.projectId,
  actor_type: "person",
  actor_id: orchestrationSpec.grantorPersonId,
  correlation_id: correlationId,
  payload,
  occurred_at: correlationId === orchestrationSpec.correlationId
    ? "2026-01-01T00:00:00+00:00"
    : "2026-01-01T01:00:00+00:00",
});

const admissionEvents = () => [
  orchestrationEvent(
    "ProjectMemberAdded",
    orchestrationSpec.correlationId,
    {
      project_id: orchestrationSpec.projectId,
      membership_id: orchestrationSpec.membershipId,
      affected_person_id: orchestrationSpec.personId,
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: orchestrationSpec.initialAssignmentId,
        project_id: orchestrationSpec.projectId,
        membership_id: orchestrationSpec.membershipId,
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: orchestrationSpec.grantorPersonId,
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
    "event-member-added",
  ),
  orchestrationEvent(
    "ProjectRoleAssigned",
    orchestrationSpec.correlationId,
    {
      project_id: orchestrationSpec.projectId,
      membership_id: orchestrationSpec.membershipId,
      affected_person_id: orchestrationSpec.personId,
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: orchestrationSpec.initialAssignmentId,
        project_id: orchestrationSpec.projectId,
        membership_id: orchestrationSpec.membershipId,
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: orchestrationSpec.grantorPersonId,
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
    "event-role-assigned",
  ),
];

const finalEvents = () => [
  ...admissionEvents(),
  orchestrationEvent(
    "ProjectRoleRevoked",
    orchestrationSpec.roleChangeCorrelationId!,
    {
      project_id: orchestrationSpec.projectId,
      membership_id: orchestrationSpec.membershipId,
      affected_person_id: orchestrationSpec.personId,
      revocation_kind: "ORDINARY_REPLACEMENT",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      successor_assignment_id: orchestrationSpec.targetAssignmentId,
      after: {
        assignment_id: orchestrationSpec.initialAssignmentId,
        project_id: orchestrationSpec.projectId,
        membership_id: orchestrationSpec.membershipId,
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: "2026-01-01T01:00:00.000Z",
        assigned_by_person_id: orchestrationSpec.grantorPersonId,
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
    "event-role-revoked",
  ),
  orchestrationEvent(
    "ProjectRoleAssigned",
    orchestrationSpec.roleChangeCorrelationId!,
    {
      project_id: orchestrationSpec.projectId,
      membership_id: orchestrationSpec.membershipId,
      affected_person_id: orchestrationSpec.personId,
      assignment_kind: "ORDINARY_CHANGE",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      previous_assignment_id: orchestrationSpec.initialAssignmentId,
      after: {
        assignment_id: orchestrationSpec.targetAssignmentId,
        project_id: orchestrationSpec.projectId,
        membership_id: orchestrationSpec.membershipId,
        role: orchestrationSpec.targetRole,
        effective_from: "2026-01-01T01:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: orchestrationSpec.grantorPersonId,
        change_reason: "VS003 local runtime fixture role shape",
        created_at: "2026-01-01T01:00:00.000Z",
      },
      transfer: null,
    },
    "event-role-replaced",
  ),
];

function createOrchestrationStore(input: {
  membership: Record<string, unknown> | null;
  assignments: Record<string, unknown>[];
  events: Record<string, unknown>[];
  failAfterAdmission?: boolean;
  appendRoleChangeEvents?: boolean;
}): MembershipStore & { calls: string[] } {
  const state = {
    membership: input.membership,
    assignments: [...input.assignments],
    events: [...input.events],
  };
  const calls: string[] = [];

  return {
    calls,
    readMembership: async () => state.membership,
    readAssignments: async () => [...state.assignments],
    readEvents: async () => [...state.events],
    addProjectMember: async () => {
      calls.push("add_project_member");
      state.membership = orchestrationMembership();
      state.assignments = [{
        ...orchestrationAssignment(),
        effective_to: null,
      }];
      state.events = input.failAfterAdmission ? [] : admissionEvents();
    },
    changeOrdinaryRole: async () => {
      calls.push("change_project_ordinary_role");
      state.assignments = [
        orchestrationAssignment(),
        orchestrationAssignment(true),
      ];
      state.events = input.appendRoleChangeEvents
        ? [...state.events, ...finalEvents().slice(2)]
        : finalEvents();
    },
  };
}

async function runOrchestration(
  input: Parameters<typeof createOrchestrationStore>[0],
) {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore(input);
  await fixture.ensureMembershipWithStore(store, orchestrationSpec);
  return store;
}

test("inconsistent admission events block role change and admission", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: orchestrationMembership(),
    assignments: [orchestrationAssignment()],
    events: [],
  });

  await assert.rejects(
    fixture.ensureMembershipWithStore(store, orchestrationSpec),
    /conflicting deterministic (fixture event|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("duplicate admission events block role change", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: orchestrationMembership(),
    assignments: [orchestrationAssignment()],
    events: [...admissionEvents(), admissionEvents()[0]],
  });

  await assert.rejects(
    fixture.ensureMembershipWithStore(store, orchestrationSpec),
    /conflicting deterministic (fixture event|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("partial future role history blocks all role mutation", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: orchestrationMembership(),
    assignments: [{ ...orchestrationAssignment(), effective_to: null }],
    events: [
      ...admissionEvents(),
      finalEvents()[2],
    ],
    appendRoleChangeEvents: true,
  });

  await assert.rejects(
    fixture.ensureMembershipWithStore(store, orchestrationSpec),
    /conflicting deterministic (fixture event|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("valid admission-only state permits exactly one role change", async () => {
  const store = await runOrchestration({
    membership: orchestrationMembership(),
    assignments: [{ ...orchestrationAssignment(), effective_to: null }],
    events: admissionEvents(),
  });

  assert.deepEqual(store.calls, ["change_project_ordinary_role"]);
});

test("already-converged state performs zero mutations", async () => {
  const store = await runOrchestration({
    membership: orchestrationMembership(),
    assignments: [orchestrationAssignment(), orchestrationAssignment(true)],
    events: finalEvents(),
  });

  assert.deepEqual(store.calls, []);
});

test("missing role-change event blocks all repair mutation", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: orchestrationMembership(),
    assignments: [orchestrationAssignment(), orchestrationAssignment(true)],
    events: admissionEvents(),
  });

  await assert.rejects(
    fixture.ensureMembershipWithStore(store, orchestrationSpec),
    /conflicting deterministic (fixture event|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("absent ordinary member admits once without role change", async () => {
  const ordinarySpec = { ...orchestrationSpec, targetAssignmentId: null, targetRole: "PROJECT_MEMBER" };
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({ membership: null, assignments: [], events: [] });
  await fixture.ensureMembershipWithStore(store, ordinarySpec);
  assert.deepEqual(store.calls, ["add_project_member"]);
});

test("absent observer orders admission verification before role change", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({ membership: null, assignments: [], events: [] });
  await fixture.ensureMembershipWithStore(store, orchestrationSpec);
  assert.deepEqual(store.calls, ["add_project_member", "change_project_ordinary_role"]);
});

test("failed post-admission verification prevents role change", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: null,
    assignments: [],
    events: [],
    failAfterAdmission: true,
  });
  await assert.rejects(
    fixture.ensureMembershipWithStore(store, orchestrationSpec),
    /conflicting deterministic fixture event/,
  );
  assert.deepEqual(store.calls, ["add_project_member"]);
});

test("two converged invocations perform zero mutations", async () => {
  const fixture = await loadFixtureModule();
  const store = createOrchestrationStore({
    membership: orchestrationMembership(),
    assignments: [orchestrationAssignment(), orchestrationAssignment(true)],
    events: finalEvents(),
  });
  await fixture.ensureMembershipWithStore(store, orchestrationSpec);
  await fixture.ensureMembershipWithStore(store, orchestrationSpec);
  assert.deepEqual(store.calls, []);
});

const FULL_FIXTURE_MEMBERSHIPS = [
  {
    id: "00333000-0000-4000-8000-000000000001",
    project_id: "00332000-0000-4000-8000-000000000001",
    person_id: "00330000-0000-4000-8000-000000000001",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    membership_status: "ACTIVE",
    granted_by_person_id: "00330000-0000-4000-8000-000000000001",
  },
  {
    id: "00333000-0000-4000-8000-000000000002",
    project_id: "00332000-0000-4000-8000-000000000001",
    person_id: "00330000-0000-4000-8000-000000000002",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    membership_status: "ACTIVE",
    granted_by_person_id: "00330000-0000-4000-8000-000000000001",
  },
  {
    id: "00333000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    person_id: "00330000-0000-4000-8000-000000000003",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    membership_status: "ACTIVE",
    granted_by_person_id: "00330000-0000-4000-8000-000000000001",
  },
  {
    id: "00333000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    person_id: "00330000-0000-4000-8000-000000000004",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    membership_status: "ACTIVE",
    granted_by_person_id: "00330000-0000-4000-8000-000000000001",
  },
  {
    id: "00333000-0000-4000-8000-000000000005",
    project_id: "00332000-0000-4000-8000-000000000002",
    person_id: "00330000-0000-4000-8000-000000000002",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    membership_status: "ACTIVE",
    granted_by_person_id: "00330000-0000-4000-8000-000000000002",
  },
];

const FULL_FIXTURE_ASSIGNMENTS = [
  {
    id: "00334000-0000-4000-8000-000000000001",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000001",
    role: "PROJECT_MEMBER",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00334000-0000-4000-8000-000000000002",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000002",
    role: "PROJECT_MEMBER",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00334000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000003",
    role: "PROJECT_MEMBER",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: "2026-01-01T01:00:00.000Z",
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00334000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000004",
    role: "PROJECT_MEMBER",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: "2026-01-01T01:00:00.000Z",
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00334000-0000-4000-8000-000000000005",
    project_id: "00332000-0000-4000-8000-000000000002",
    membership_id: "00333000-0000-4000-8000-000000000005",
    role: "PROJECT_MEMBER",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    assigned_by_person_id: "00330000-0000-4000-8000-000000000002",
    change_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00335000-0000-4000-8000-000000000001",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000003",
    role: "PROJECT_OBSERVER",
    effective_from: "2026-01-01T01:00:00.000Z",
    effective_to: null,
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: "VS003 local runtime fixture role shape",
    created_at: "2026-01-01T01:00:00.000Z",
  },
  {
    id: "00335000-0000-4000-8000-000000000002",
    project_id: "00332000-0000-4000-8000-000000000001",
    membership_id: "00333000-0000-4000-8000-000000000004",
    role: "PROJECT_AUDITOR",
    effective_from: "2026-01-01T01:00:00.000Z",
    effective_to: null,
    assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
    change_reason: "VS003 local runtime fixture role shape",
    created_at: "2026-01-01T01:00:00.000Z",
  },
];

const FULL_FIXTURE_EVENTS = [
  {
    id: "test-event-001",
    event_type: "ProjectMemberAdded",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000001",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000001",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000001",
      affected_person_id: "00330000-0000-4000-8000-000000000001",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: "00334000-0000-4000-8000-000000000001",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000001",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
  },
  {
    id: "test-event-002",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000001",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000001",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000001",
      affected_person_id: "00330000-0000-4000-8000-000000000001",
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000001",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000001",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-003",
    event_type: "ProjectMemberAdded",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000002",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000002",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000002",
      affected_person_id: "00330000-0000-4000-8000-000000000002",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: "00334000-0000-4000-8000-000000000002",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000002",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
  },
  {
    id: "test-event-004",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000002",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000002",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000002",
      affected_person_id: "00330000-0000-4000-8000-000000000002",
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000002",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000002",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-005",
    event_type: "ProjectMemberAdded",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000003",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000003",
      affected_person_id: "00330000-0000-4000-8000-000000000003",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: "00334000-0000-4000-8000-000000000003",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000003",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
  },
  {
    id: "test-event-006",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000003",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000003",
      affected_person_id: "00330000-0000-4000-8000-000000000003",
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000003",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000003",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-007",
    event_type: "ProjectMemberAdded",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000004",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000004",
      affected_person_id: "00330000-0000-4000-8000-000000000004",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: "00334000-0000-4000-8000-000000000004",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000004",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
  },
  {
    id: "test-event-008",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00336000-0000-4000-8000-000000000004",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000004",
      affected_person_id: "00330000-0000-4000-8000-000000000004",
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000004",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000004",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-009",
    event_type: "ProjectMemberAdded",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000005",
    project_id: "00332000-0000-4000-8000-000000000002",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000002",
    correlation_id: "00336000-0000-4000-8000-000000000005",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000002",
      membership_id: "00333000-0000-4000-8000-000000000005",
      affected_person_id: "00330000-0000-4000-8000-000000000002",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      initial_role_assignment: {
        assignment_id: "00334000-0000-4000-8000-000000000005",
        project_id: "00332000-0000-4000-8000-000000000002",
        membership_id: "00333000-0000-4000-8000-000000000005",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000002",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    },
  },
  {
    id: "test-event-010",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000005",
    project_id: "00332000-0000-4000-8000-000000000002",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000002",
    correlation_id: "00336000-0000-4000-8000-000000000005",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000002",
      membership_id: "00333000-0000-4000-8000-000000000005",
      affected_person_id: "00330000-0000-4000-8000-000000000002",
      assignment_kind: "INITIAL_ORDINARY",
      effective_at: "2026-01-01T00:00:00.000Z",
      reason: null,
      previous_assignment_id: null,
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000005",
        project_id: "00332000-0000-4000-8000-000000000002",
        membership_id: "00333000-0000-4000-8000-000000000005",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000002",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-011",
    event_type: "ProjectRoleRevoked",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00337000-0000-4000-8000-000000000001",
    occurred_at: "2026-01-01T01:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000003",
      affected_person_id: "00330000-0000-4000-8000-000000000003",
      revocation_kind: "ORDINARY_REPLACEMENT",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      previous_assignment_id: "00334000-0000-4000-8000-000000000003",
      successor_assignment_id: "00335000-0000-4000-8000-000000000001",
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000003",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000003",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: "2026-01-01T01:00:00.000Z",
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-012",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000003",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00337000-0000-4000-8000-000000000001",
    occurred_at: "2026-01-01T01:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000003",
      affected_person_id: "00330000-0000-4000-8000-000000000003",
      assignment_kind: "ORDINARY_CHANGE",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      previous_assignment_id: "00334000-0000-4000-8000-000000000003",
      after: {
        assignment_id: "00335000-0000-4000-8000-000000000001",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000003",
        role: "PROJECT_OBSERVER",
        effective_from: "2026-01-01T01:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: "VS003 local runtime fixture role shape",
        created_at: "2026-01-01T01:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-013",
    event_type: "ProjectRoleRevoked",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00337000-0000-4000-8000-000000000002",
    occurred_at: "2026-01-01T01:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000004",
      affected_person_id: "00330000-0000-4000-8000-000000000004",
      revocation_kind: "ORDINARY_REPLACEMENT",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      previous_assignment_id: "00334000-0000-4000-8000-000000000004",
      successor_assignment_id: "00335000-0000-4000-8000-000000000002",
      after: {
        assignment_id: "00334000-0000-4000-8000-000000000004",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000004",
        role: "PROJECT_MEMBER",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: "2026-01-01T01:00:00.000Z",
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      transfer: null,
    },
  },
  {
    id: "test-event-014",
    event_type: "ProjectRoleAssigned",
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: "00333000-0000-4000-8000-000000000004",
    project_id: "00332000-0000-4000-8000-000000000001",
    actor_type: "person",
    actor_id: "00330000-0000-4000-8000-000000000001",
    correlation_id: "00337000-0000-4000-8000-000000000002",
    occurred_at: "2026-01-01T01:00:00.000Z",
    payload: {
      project_id: "00332000-0000-4000-8000-000000000001",
      membership_id: "00333000-0000-4000-8000-000000000004",
      affected_person_id: "00330000-0000-4000-8000-000000000004",
      assignment_kind: "ORDINARY_CHANGE",
      effective_at: "2026-01-01T01:00:00.000Z",
      reason: "VS003 local runtime fixture role shape",
      previous_assignment_id: "00334000-0000-4000-8000-000000000004",
      after: {
        assignment_id: "00335000-0000-4000-8000-000000000002",
        project_id: "00332000-0000-4000-8000-000000000001",
        membership_id: "00333000-0000-4000-8000-000000000004",
        role: "PROJECT_AUDITOR",
        effective_from: "2026-01-01T01:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00330000-0000-4000-8000-000000000001",
        change_reason: "VS003 local runtime fixture role shape",
        created_at: "2026-01-01T01:00:00.000Z",
      },
      transfer: null,
    },
  },
];

function completeFixtureMembershipStore(
  options: {
    removeAssignmentId?: string;
    removeEvent?: { correlationId: string; eventType: string };
  } = {},
): MembershipStore & {
  calls: string[];
  memberships: number;
  assignments: number;
  events: number;
  correlations: number;
  eventsByCorrelation: Map<string, number>;
  membershipIds: string[];
  assignmentIds: string[];
  correlationIds: string[];
} {
  const memberships = new Map<string, Record<string, unknown>>();
  const assignments = new Map<string, Record<string, unknown>[]>();
  const events = FULL_FIXTURE_EVENTS.filter((event) =>
    !options.removeEvent ||
    event.correlation_id !== options.removeEvent.correlationId ||
    event.event_type !== options.removeEvent.eventType,
  );
  const calls: string[] = [];

  for (const membership of FULL_FIXTURE_MEMBERSHIPS) {
    memberships.set(membership.id, { ...membership });
  }
  for (const assignment of FULL_FIXTURE_ASSIGNMENTS) {
    if (assignment.id === options.removeAssignmentId) continue;
    const rows = assignments.get(assignment.membership_id) ?? [];
    rows.push({ ...assignment });
    assignments.set(assignment.membership_id, rows);
  }

  return {
    calls,
    memberships: memberships.size,
    assignments: [...assignments.values()].reduce((total, rows) => total + rows.length, 0),
    events: events.length,
    correlations: new Set(events.map((event) => event.correlation_id)).size,
    eventsByCorrelation: new Map(
      [...new Set(events.map((event) => event.correlation_id))].map((correlationId) => [
        correlationId,
        events.filter((event) => event.correlation_id === correlationId).length,
      ]),
    ),
    membershipIds: [...memberships.keys()],
    assignmentIds: FULL_FIXTURE_ASSIGNMENTS
      .filter((assignment) => assignment.id !== options.removeAssignmentId)
      .map((assignment) => assignment.id),
    correlationIds: [...new Set(events.map((event) => event.correlation_id))],
    readMembership: async (spec) => memberships.get(spec.membershipId) ?? null,
    readAssignments: async (spec) => assignments.get(spec.membershipId) ?? [],
    readEvents: async (spec) => events.filter((event) =>
      event.correlation_id === spec.correlationId ||
      event.correlation_id === spec.roleChangeCorrelationId,
    ),
    addProjectMember: async () => { calls.push("add_project_member"); },
    changeOrdinaryRole: async () => { calls.push("change_project_ordinary_role"); },
  };
}

function earlyAbsentLateConflictStore(
  fixture: FixtureModule,
): MembershipStore & { calls: string[] } {
  type MutableMembershipState = {
    membership: Record<string, unknown> | null;
    assignments: Record<string, unknown>[];
    events: Record<string, unknown>[];
  };
  const states = new Map<string, MutableMembershipState>(
    fixture.VS003_RUNTIME_MEMBERSHIP_SPECS.map((spec, index): [string, MutableMembershipState] => {
      const membership = {
        id: spec.membershipId,
        project_id: spec.projectId,
        person_id: spec.personId,
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        membership_status: "ACTIVE",
        granted_by_person_id: spec.grantorPersonId,
      };
      const admissionEvents = fixture.expectedVs003Events().filter((event) =>
        event.correlation_id === spec.correlationId,
      );
      return [
        spec.membershipId,
        {
          membership: index === 0 ? null : membership,
          assignments: index === 0
            ? []
            : index === 3
              ? fixture.expectedAssignmentHistory(spec, false)
              : fixture.expectedAssignmentHistory(spec, Boolean(spec.targetAssignmentId)),
          events: index === 0
            ? []
              : index === 3
              ? admissionEvents.slice(0, 1)
              : fixture.expectedVs003Events().filter((event) =>
                  event.correlation_id === spec.correlationId ||
                  event.correlation_id === spec.roleChangeCorrelationId,
                ),
        },
      ];
    }),
  );
  const calls: string[] = [];

  return {
    calls,
    readMembership: async (spec) => states.get(spec.membershipId)!.membership,
    readAssignments: async (spec) => states.get(spec.membershipId)!.assignments,
    readEvents: async (spec) => states.get(spec.membershipId)!.events,
    addProjectMember: async (spec) => {
      calls.push(`add_project_member:${spec.membershipId}`);
      const state = states.get(spec.membershipId)!;
      state.membership = {
        id: spec.membershipId,
        project_id: spec.projectId,
        person_id: spec.personId,
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
        membership_status: "ACTIVE",
        granted_by_person_id: spec.grantorPersonId,
      };
      state.assignments = fixture.expectedAssignmentHistory(spec, false);
      state.events = fixture.expectedVs003Events().filter((event) =>
        event.correlation_id === spec.correlationId,
      );
    },
    changeOrdinaryRole: async (spec) => {
      calls.push(`change_project_ordinary_role:${spec.membershipId}`);
      const state = states.get(spec.membershipId)!;
      state.assignments = fixture.expectedAssignmentHistory(spec, true);
      state.events = fixture.expectedVs003Events().filter((event) =>
        event.correlation_id === spec.correlationId ||
        event.correlation_id === spec.roleChangeCorrelationId,
      );
    },
  };
}

test("early absent membership is not mutated before a later conflict", async () => {
  const fixture = await loadFixtureModule();
  const store = earlyAbsentLateConflictStore(fixture);

  await assert.rejects(
    fixture.reconcileFixtureMembershipsWithStore(store),
    /conflicting deterministic (fixture event|role assignment|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("complete deterministic fixture converges with zero canonical mutations", async () => {
  const fixture = await loadFixtureModule();
  const store = completeFixtureMembershipStore();

  assert.equal(fixture.VS003_RUNTIME_MEMBERSHIP_SPECS.length, 5);
  assert.deepEqual(store.membershipIds, [
    "00333000-0000-4000-8000-000000000001",
    "00333000-0000-4000-8000-000000000002",
    "00333000-0000-4000-8000-000000000003",
    "00333000-0000-4000-8000-000000000004",
    "00333000-0000-4000-8000-000000000005",
  ]);
  assert.deepEqual(store.assignmentIds, [
    "00334000-0000-4000-8000-000000000001",
    "00334000-0000-4000-8000-000000000002",
    "00334000-0000-4000-8000-000000000003",
    "00334000-0000-4000-8000-000000000004",
    "00334000-0000-4000-8000-000000000005",
    "00335000-0000-4000-8000-000000000001",
    "00335000-0000-4000-8000-000000000002",
  ]);
  assert.deepEqual(store.correlationIds, [
    "00336000-0000-4000-8000-000000000001",
    "00336000-0000-4000-8000-000000000002",
    "00336000-0000-4000-8000-000000000003",
    "00336000-0000-4000-8000-000000000004",
    "00336000-0000-4000-8000-000000000005",
    "00337000-0000-4000-8000-000000000001",
    "00337000-0000-4000-8000-000000000002",
  ]);
  assert.equal(store.memberships, 5);
  assert.equal(store.assignments, 7);
  assert.equal(store.correlations, 7);
  assert.equal(store.events, 14);
  await fixture.reconcileFixtureMembershipsWithStore(store);

  assert.deepEqual(store.calls, []);
});

test("missing deterministic assignment rejects with zero canonical mutations", async () => {
  const fixture = await loadFixtureModule();
  const store = completeFixtureMembershipStore({
    removeAssignmentId: "00335000-0000-4000-8000-000000000001",
  });

  await assert.rejects(
    fixture.reconcileFixtureMembershipsWithStore(store),
    /conflicting deterministic (role assignment|VS003 membership state)/i,
  );
  assert.deepEqual(store.calls, []);
});

test("missing deterministic event rejects with zero canonical mutations", async () => {
  const fixture = await loadFixtureModule();
  const missingCorrelationId =
    "00336000-0000-4000-8000-000000000005";
  const store = completeFixtureMembershipStore({
    removeEvent: {
      correlationId: missingCorrelationId,
      eventType: "ProjectMemberAdded",
    },
  });

  assert.equal(store.events, 13);
  assert.equal(store.correlations, 7);
  assert.equal(store.eventsByCorrelation.get(missingCorrelationId), 1);

  await assert.rejects(
    fixture.reconcileFixtureMembershipsWithStore(store),
    /conflicting deterministic fixture event/,
  );
  assert.deepEqual(store.calls, []);
});

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: "assignment-1",
  project_id: "project-1",
  membership_id: "membership-1",
  role: "PROJECT_MEMBER",
  effective_from: "2026-01-01T00:00:00.000Z",
  effective_to: null,
  assigned_by_person_id: "person-1",
  change_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const expectedAssignments = [assignment()];

test("assignment validator accepts the exact expected assignment set", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(expectedAssignments, expectedAssignments),
  );
});

test("assignment validator rejects an unexpected extra assignment", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(
      [...expectedAssignments, assignment({ id: "unexpected" })],
      expectedAssignments,
    ),
  /conflicting deterministic role assignment/);
});

test("assignment validator rejects a missing expected assignment", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")([], expectedAssignments),
  /conflicting deterministic role assignment/);
});

test("assignment validator rejects a wrong role", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(
      [assignment({ role: "PROJECT_AUDITOR" })],
      expectedAssignments,
    ),
  /conflicting deterministic role assignment/);
});

test("assignment validator rejects a wrong change_reason", async () => {
  const fixture = await loadFixtureModule();
  const expected = [assignment({ change_reason: "VS003 local runtime fixture role shape" })];
  assert.throws(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(
      [assignment({ change_reason: "tampered" })],
      expected,
    ),
  /conflicting deterministic role assignment/);
});

test("assignment validator accepts equivalent timestamp encodings", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(
      [assignment({ effective_from: "2026-01-01T00:00:00+00:00" })],
      expectedAssignments,
    ),
  );
});

test("assignment validator rejects a genuinely different timestamp", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertAssignmentHistoryExact")(
      [assignment({ effective_from: "2026-01-01T00:00:01.000Z" })],
      expectedAssignments,
    ),
  /conflicting deterministic role assignment/);
});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  event_type: "ProjectMemberAdded",
  event_version: 1,
  aggregate_type: "project_membership",
  aggregate_id: "membership-1",
  project_id: "project-1",
  actor_type: "person",
  actor_id: "person-1",
  correlation_id: "correlation-1",
  payload: { membership_id: "membership-1", project_id: "project-1" },
  occurred_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const expectedEvents = [event()];

const timestampedEvent = (overrides: Record<string, unknown> = {}) =>
  event({
    payload: {
      project_id: "project-1",
      membership_id: "membership-1",
      role: "PROJECT_MEMBER",
      effective_at: "2026-01-01T00:00:00.000Z",
      after: {
        assignment_id: "assignment-1",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
      },
    },
    ...overrides,
  });

test("event validator accepts equivalent nested deterministic timestamps", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent({
        occurred_at: "2026-01-01T00:00:00+00:00",
        payload: {
          ...timestampedEvent().payload as Record<string, unknown>,
          effective_at: "2026-01-01T00:00:00+00:00",
          after: {
            assignment_id: "assignment-1",
            effective_from: "2026-01-01T00:00:00+00:00",
            effective_to: null,
          },
        },
      })],
      [timestampedEvent()],
    ),
  );
});

test("event validator rejects a different nested deterministic timestamp", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent({
        payload: {
          ...timestampedEvent().payload as Record<string, unknown>,
          after: {
            assignment_id: "assignment-1",
            effective_from: "2026-01-01T00:00:01+00:00",
            effective_to: null,
          },
        },
      })],
      [timestampedEvent()],
    ),
  /conflicting deterministic fixture event/);
});

test("event validator still rejects non-timestamp payload mismatches", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent({
        payload: {
          ...timestampedEvent().payload as Record<string, unknown>,
          role: "PROJECT_AUDITOR",
        },
      })],
      [timestampedEvent()],
    ),
  /conflicting deterministic fixture event/);
});

test("event validator accepts equivalent top-level and nested timestamps", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent({
        occurred_at: "2026-01-01T00:00:00+00:00",
        payload: {
          ...timestampedEvent().payload as Record<string, unknown>,
          effective_at: "2026-01-01T00:00:00+00:00",
          after: {
            assignment_id: "assignment-1",
            effective_from: "2026-01-01T00:00:00+00:00",
            effective_to: null,
          },
        },
      })],
      [timestampedEvent()],
    ),
  );
});

test("event validator preserves nullable nested timestamp semantics", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent()],
      [timestampedEvent()],
    ),
  );
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [timestampedEvent({
        payload: {
          ...timestampedEvent().payload as Record<string, unknown>,
          after: {
            assignment_id: "assignment-1",
            effective_from: "2026-01-01T00:00:00+00:00",
            effective_to: "2026-01-01T01:00:00+00:00",
          },
        },
      })],
      [timestampedEvent()],
    ),
  /conflicting deterministic fixture event/);
});

test("event validator accepts the exact expected VS003 event set", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(expectedEvents, expectedEvents),
  );
});

test("event validator rejects a missing expected fixture event", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")([], expectedEvents),
  /conflicting deterministic fixture event/);
});

test("event validator rejects a duplicate expected fixture event", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")([...expectedEvents, event({ id: "event-2" })], expectedEvents),
  /conflicting deterministic fixture event/);
});

test("event validator rejects a contradictory fixture event", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [event({ event_type: "ProjectRoleAssigned" })],
      expectedEvents,
    ),
  /conflicting deterministic fixture event/);
});

test("event validator ignores unrelated external events", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [...expectedEvents, event({ id: "external", correlation_id: "external-correlation" })],
      expectedEvents,
    ),
  );
});

test("event validator scopes reconciliation by correlation IDs, not global row count", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertVs003DomainEventsExact")(
      [...expectedEvents, event({ id: "external-1", correlation_id: "external-1" }), event({ id: "external-2", correlation_id: "external-2" })],
      expectedEvents,
    ),
  );
});

const projectState = {
  id: "project-1",
  name: "[VS003 LOCAL] Shared Discussion Project",
  description: "description",
  goal: "goal",
  marker: "[VS003 LOCAL] Shared Discussion Project",
  lifecycle_status: "active",
  progress_percent: 0,
  owner_user_id: "user-1",
  start_date: "2026-01-01",
  target_date: null,
};

test("project validator accepts exact persisted project state", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertDeterministicProjectState")(projectState, projectState),
  );
});

test("project validator rejects a conflicting deterministic field", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertDeterministicProjectState")(
      { ...projectState, owner_user_id: "other-user" },
      projectState,
    ),
  /conflicting deterministic project/);
});

const projectHealth = {
  project_id: "project-1",
  health_status: "on_track",
  reasons: [],
  source: "system",
  changed_by: null,
};

test("project-health validator accepts exact persisted health state", async () => {
  const fixture = await loadFixtureModule();
  assert.doesNotThrow(() =>
    requireValidator(fixture, "assertDeterministicProjectHealth")(projectHealth, projectHealth),
  );
});

test("project-health validator rejects a conflicting deterministic field", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(() =>
    requireValidator(fixture, "assertDeterministicProjectHealth")(
      { ...projectHealth, changed_by: "person-1" },
      projectHealth,
    ),
  /conflicting project-health state/);
});

const safePasswords = {
  CADENCE_VS003_USER_A_PASSWORD: "local-password-a-1234",
  CADENCE_VS003_USER_B_PASSWORD: "local-password-b-1234",
  CADENCE_VS003_OBSERVER_PASSWORD: "local-password-observer-1234",
  CADENCE_VS003_AUDITOR_PASSWORD: "local-password-auditor-1234",
  CADENCE_VS003_NONMEMBER_PASSWORD: "local-password-nonmember-1234",
};

test("runtime password validator rejects a missing required fixture password", async () => {
  const fixture = await loadFixtureModule();
  const passwords: Record<string, string | undefined> = { ...safePasswords };
  delete passwords.CADENCE_VS003_USER_A_PASSWORD;
  assert.throws(() => requireValidator(fixture, "assertVs003LocalPasswords")(passwords), /CADENCE_VS003_USER_A_PASSWORD/);
});

test("runtime password validator rejects an unsafe fixture password", async () => {
  const fixture = await loadFixtureModule();
  assert.throws(
    () => requireValidator(fixture, "assertVs003LocalPasswords")({ ...safePasswords, CADENCE_VS003_USER_A_PASSWORD: "short" }),
    /at least 16 characters/,
  );
});

test("VS003 bootstrap package command includes the local environment check", () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.match(packageJson.scripts["local:bootstrap:vs003"], /env:local:check/);
});

test("VS003 bootstrap package command loads .env.local", () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.match(packageJson.scripts["local:bootstrap:vs003"], /--env-file=\.env\.local/);
});

test("VS003 package script does not alter existing bootstrap or startup commands", () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts.local, undefined);
  assert.match(packageJson.scripts["local:bootstrap"], /bootstrap-local-dev\.ts/);
  assert.equal(packageJson.scripts.dev, "npm run dev:local");
  assert.equal(packageJson.scripts.start, "npm run start:local");
  assert.match(packageJson.scripts["dev:local"], /src\/server\.ts/);
  assert.match(packageJson.scripts["start:local"], /src\/server\.ts/);
  assert.match(packageJson.scripts["worker:local"], /src\/worker\.ts/);
});
