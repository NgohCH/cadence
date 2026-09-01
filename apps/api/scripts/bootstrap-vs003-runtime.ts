import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  validateCadenceEnvironmentSafety,
} from "../src/bootstrap/environment-safety";


const BASELINE_AT =
  "2026-01-01T00:00:00.000Z";

const ROLE_CHANGE_AT =
  "2026-01-01T01:00:00.000Z";


type RuntimeActor = {
  key: string;
  email: string;
  displayName: string;
  username: string;
  personId: string;
  userId: string;
  p1Role: string | null;
  p2Role: string | null;
};


type RuntimeProject = {
  id: string;
  name: string;
  description: string;
  goal: string;
  marker: string;
  ownerUserId: string;
};


export const VS003_RUNTIME_FIXTURE = {
  actors: {
    userA: {
      key: "userA",
      email: "vs003.user-a@cadence.test",
      displayName: "VS003 User A",
      username: "vs003_user_a",
      personId:
        "00330000-0000-4000-8000-000000000001",
      userId:
        "00331000-0000-4000-8000-000000000001",
      p1Role: "PROJECT_MEMBER",
      p2Role: null,
    },

    userB: {
      key: "userB",
      email: "vs003.user-b@cadence.test",
      displayName: "VS003 User B",
      username: "vs003_user_b",
      personId:
        "00330000-0000-4000-8000-000000000002",
      userId:
        "00331000-0000-4000-8000-000000000002",
      p1Role: "PROJECT_MEMBER",
      p2Role: "PROJECT_MEMBER",
    },

    observer: {
      key: "observer",
      email: "vs003.observer@cadence.test",
      displayName: "VS003 Observer",
      username: "vs003_observer",
      personId:
        "00330000-0000-4000-8000-000000000003",
      userId:
        "00331000-0000-4000-8000-000000000003",
      p1Role: "PROJECT_OBSERVER",
      p2Role: null,
    },

    auditor: {
      key: "auditor",
      email: "vs003.auditor@cadence.test",
      displayName: "VS003 Auditor",
      username: "vs003_auditor",
      personId:
        "00330000-0000-4000-8000-000000000004",
      userId:
        "00331000-0000-4000-8000-000000000004",
      p1Role: "PROJECT_AUDITOR",
      p2Role: null,
    },

    nonmember: {
      key: "nonmember",
      email: "vs003.nonmember@cadence.test",
      displayName: "VS003 Nonmember",
      username: "vs003_nonmember",
      personId:
        "00330000-0000-4000-8000-000000000005",
      userId:
        "00331000-0000-4000-8000-000000000005",
      p1Role: null,
      p2Role: null,
    },
  },

  projects: {
    p1: {
      id:
        "00332000-0000-4000-8000-000000000001",
      name:
        "[VS003 LOCAL] Shared Discussion Project",
      description:
        "[VS003 LOCAL] Shared project for deterministic Discussion runtime verification.",
      goal:
        "Exercise authenticated multi-actor Discussion reads and writes.",
      marker:
        "[VS003 LOCAL] Shared Discussion Project",
      ownerUserId:
        "00331000-0000-4000-8000-000000000001",
    },

    p2: {
      id:
        "00332000-0000-4000-8000-000000000002",
      name:
        "[VS003 LOCAL] Isolation Project",
      description:
        "[VS003 LOCAL] Separate project for cross-project concealment checks.",
      goal:
        "Exercise deterministic project isolation.",
      marker:
        "[VS003 LOCAL] Isolation Project",
      ownerUserId:
        "00331000-0000-4000-8000-000000000002",
    },
  },
} as const;


type FixtureActorKey = keyof typeof VS003_RUNTIME_FIXTURE.actors;


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


export const VS003_RUNTIME_MEMBERSHIP_SPECS: readonly MembershipSpec[] = [
  {
    membershipId:
      "00333000-0000-4000-8000-000000000001",
    initialAssignmentId:
      "00334000-0000-4000-8000-000000000001",
    targetAssignmentId: null,
    correlationId:
      "00336000-0000-4000-8000-000000000001",
    roleChangeCorrelationId: null,
    projectId:
      VS003_RUNTIME_FIXTURE.projects.p1.id,
    personId:
      VS003_RUNTIME_FIXTURE.actors.userA.personId,
    grantorPersonId:
      VS003_RUNTIME_FIXTURE.actors.userA.personId,
    targetRole: "PROJECT_MEMBER",
  },

  {
    membershipId:
      "00333000-0000-4000-8000-000000000002",
    initialAssignmentId:
      "00334000-0000-4000-8000-000000000002",
    targetAssignmentId: null,
    correlationId:
      "00336000-0000-4000-8000-000000000002",
    roleChangeCorrelationId: null,
    projectId:
      VS003_RUNTIME_FIXTURE.projects.p1.id,
    personId:
      VS003_RUNTIME_FIXTURE.actors.userB.personId,
    grantorPersonId:
      VS003_RUNTIME_FIXTURE.actors.userA.personId,
    targetRole: "PROJECT_MEMBER",
  },

  {
    membershipId:
      "00333000-0000-4000-8000-000000000003",
    initialAssignmentId:
      "00334000-0000-4000-8000-000000000003",
    targetAssignmentId:
      "00335000-0000-4000-8000-000000000001",
    correlationId:
      "00336000-0000-4000-8000-000000000003",
    roleChangeCorrelationId:
      "00337000-0000-4000-8000-000000000001",
    projectId:
      VS003_RUNTIME_FIXTURE.projects.p1.id,
    personId:
      VS003_RUNTIME_FIXTURE.actors.observer.personId,
    grantorPersonId:
      VS003_RUNTIME_FIXTURE.actors.userA.personId,
    targetRole: "PROJECT_OBSERVER",
  },

  {
    membershipId:
      "00333000-0000-4000-8000-000000000004",
    initialAssignmentId:
      "00334000-0000-4000-8000-000000000004",
    targetAssignmentId:
      "00335000-0000-4000-8000-000000000002",
    correlationId:
      "00336000-0000-4000-8000-000000000004",
    roleChangeCorrelationId:
      "00337000-0000-4000-8000-000000000002",
    projectId:
      VS003_RUNTIME_FIXTURE.projects.p1.id,
    personId:
      VS003_RUNTIME_FIXTURE.actors.auditor.personId,
    grantorPersonId:
      VS003_RUNTIME_FIXTURE.actors.userA.personId,
    targetRole: "PROJECT_AUDITOR",
  },

  {
    membershipId:
      "00333000-0000-4000-8000-000000000005",
    initialAssignmentId:
      "00334000-0000-4000-8000-000000000005",
    targetAssignmentId: null,
    correlationId:
      "00336000-0000-4000-8000-000000000005",
    roleChangeCorrelationId: null,
    projectId:
      VS003_RUNTIME_FIXTURE.projects.p2.id,
    personId:
      VS003_RUNTIME_FIXTURE.actors.userB.personId,
    grantorPersonId:
      VS003_RUNTIME_FIXTURE.actors.userB.personId,
    targetRole: "PROJECT_MEMBER",
  },
];


type ExistingIdentity = {
  id: string;
  authUserId: string;
  personId: string;
  provider: string;
  providerSubjectId: string;
  loginIdentifier: string;
  validFrom: string;
  validTo: string | null;
  status: string;
};


type ExpectedIdentity = ExistingIdentity;


type ActorPreflightStore = {
  readAuthUser: (actor: RuntimeActor) => Promise<{ id: string } | null>;
  readActiveIdentities: (actor: RuntimeActor) => Promise<Record<string, unknown>[]>;
  readPerson: (actor: RuntimeActor) => Promise<Record<string, unknown> | null>;
  readCadenceUser: (actor: RuntimeActor, authUserId: string | null) => Promise<Record<string, unknown> | null>;
};


export function assertVs003LocalEnvironment(input: {
  cadenceEnv: string | undefined;
  supabaseUrl: string | undefined;
  supabaseProjectRef: string | undefined;
}): void {
  if (input.cadenceEnv?.trim().toLowerCase() !== "local") {
    throw new Error(
      "VS003 runtime fixture requires CADENCE_ENV=local.",
    );
  }

  validateCadenceEnvironmentSafety(input);
}


export function planMembershipReconciliation(input: {
  membershipExists: boolean;
  currentRole: string | null;
  targetRole: string;
}): string[] {
  if (input.targetRole === "NONE") {
    return [];
  }

  if (!input.membershipExists) {
    return ["add_project_member"];
  }

  if (input.currentRole === input.targetRole) {
    return [];
  }

  if (
    input.currentRole === "PROJECT_MEMBER" &&
    (input.targetRole === "PROJECT_OBSERVER" ||
      input.targetRole === "PROJECT_AUDITOR")
  ) {
    return ["change_project_ordinary_role"];
  }

  throw new Error(
    `Unsupported VS003 membership transition from ${input.currentRole ?? "none"} to ${input.targetRole}.`,
  );
}


export function assertDeterministicIdentity(
  existing: ExistingIdentity,
  expected: ExpectedIdentity,
): void {
  if (
    existing.id !== expected.id ||
    existing.authUserId !== expected.authUserId ||
    existing.personId !== expected.personId ||
    existing.provider !== expected.provider ||
    existing.providerSubjectId !== expected.providerSubjectId ||
    existing.loginIdentifier !== expected.loginIdentifier ||
    !timestampsEqual(existing.validFrom, expected.validFrom) ||
    !timestampsEqualNullable(existing.validTo, expected.validTo) ||
    existing.status !== expected.status
  ) {
    throw new Error(
      "conflicting deterministic identity.",
    );
  }
}


export function assertDeterministicProject(
  existing: { id: string; marker: string },
  expected: { id: string; marker: string },
): void {
  if (
    existing.id !== expected.id ||
    existing.marker !== expected.marker
  ) {
    throw new Error(
      "conflicting deterministic project.",
    );
  }
}


type DeterministicProjectState = Record<string, unknown>;


export function assertDeterministicProjectState(
  existing: DeterministicProjectState,
  expected: DeterministicProjectState,
): void {
  const fields = [
    "id",
    "name",
    "description",
    "goal",
    "marker",
    "lifecycle_status",
    "progress_percent",
    "owner_user_id",
    "start_date",
    "target_date",
  ];

  if (fields.some((field) => existing[field] !== expected[field])) {
    throw new Error("conflicting deterministic project.");
  }
}


export function assertDeterministicProjectHealth(
  existing: Record<string, unknown>,
  expected: Record<string, unknown>,
): void {
  const fields = [
    "project_id",
    "health_status",
    "reasons",
    "source",
    "changed_by",
  ];

  if (
    fields.some(
      (field) =>
        JSON.stringify(existing[field]) !==
        JSON.stringify(expected[field]),
    )
  ) {
    throw new Error("conflicting project-health state.");
  }
}


export function planProjectHealthReconciliation(
  existing: {
    healthStatus: string;
    reasons: unknown;
    source: string;
    changedBy: string | null;
  } | null,
): string {
  if (!existing) {
    return "create";
  }

  if (
    existing.healthStatus === "on_track" &&
    Array.isArray(existing.reasons) &&
    existing.reasons.length === 0 &&
    existing.source === "system" &&
    existing.changedBy === null
  ) {
    return "reuse";
  }

  throw new Error(
    "conflicting project-health state.",
  );
}


function requireEnvironmentValue(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}


function requireLocalPassword(
  name: string,
): string {
  const value = requireEnvironmentValue(name);

  if (value.length < 16) {
    throw new Error(
      `${name} must contain at least 16 characters for local development.`,
    );
  }

  return value;
}


const REQUIRED_VS003_PASSWORDS = [
  "CADENCE_VS003_USER_A_PASSWORD",
  "CADENCE_VS003_USER_B_PASSWORD",
  "CADENCE_VS003_OBSERVER_PASSWORD",
  "CADENCE_VS003_AUDITOR_PASSWORD",
  "CADENCE_VS003_NONMEMBER_PASSWORD",
] as const;


export function assertVs003LocalPasswords(
  passwords: Record<string, string | undefined>,
): void {
  for (const name of REQUIRED_VS003_PASSWORDS) {
    const value = passwords[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required.`);
    }

    if (value.length < 16) {
      throw new Error(
        `${name} must contain at least 16 characters for local development.`,
      );
    }
  }
}


function throwSupabaseError(
  context: string,
  error: { message: string } | null,
): never {
  throw new Error(
    `${context}: ${error?.message ?? "Supabase returned an unknown error."}`,
  );
}


function getAdminClient(): SupabaseClient {
  assertVs003LocalEnvironment({
    cadenceEnv: process.env.CADENCE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseProjectRef:
      process.env.CADENCE_SUPABASE_PROJECT_REF,
  });

  const secretKey =
    requireEnvironmentValue(
      "SUPABASE_SECRET_KEY",
    );

  return createClient(
    requireEnvironmentValue("SUPABASE_URL"),
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Cadence-VS003-Fixture": "local",
        },
      },
    },
  );
}


async function findAuthUser(
  admin: SupabaseClient,
  email: string,
): Promise<{
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null> {
  const { data, error } =
    await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (error) {
    throwSupabaseError(
      "Unable to list local Supabase Auth users",
      error,
    );
  }

  const matches = data.users.filter(
    (user) =>
      user.email?.trim().toLowerCase() ===
      email.toLowerCase(),
  );

  if (matches.length > 1) {
    throw new Error(
      `Multiple local Supabase Auth users exist for ${email}.`,
    );
  }

  return matches[0]
    ? {
        id: matches[0].id,
        email: matches[0].email,
        user_metadata:
          matches[0].user_metadata as Record<
            string,
            unknown
          > | null,
      }
    : null;
}


function createActorPreflightStore(
  admin: SupabaseClient,
): ActorPreflightStore {
  return {
    readAuthUser: async (actor) => findAuthUser(admin, actor.email),
    readActiveIdentities: async (actor) => {
      const { data, error } = await admin
        .from("authentication_identities")
        .select(
          "id, person_id, provider, provider_subject_id, login_identifier, valid_from, valid_to, status",
        )
        .eq("person_id", actor.personId)
        .eq("status", "ACTIVE");

      if (error) {
        throwSupabaseError(
          `Unable to read authentication identities for ${actor.personId}`,
          error,
        );
      }

      return (data ?? []) as Record<string, unknown>[];
    },
    readPerson: async (actor) => {
      const { data, error } = await admin
        .from("persons")
        .select("id, display_name")
        .eq("id", actor.personId)
        .maybeSingle();

      if (error) {
        throwSupabaseError(
          `Unable to read Person ${actor.personId}`,
          error,
        );
      }

      return data as Record<string, unknown> | null;
    },
    readCadenceUser: async (actor, authUserId) => {
      const { data, error } = await admin
        .from("users")
        .select(
          "id, auth_user_id, person_id, username, display_name, email, status, identity_provider",
        )
        .eq("id", actor.userId)
        .maybeSingle();

      if (error) {
        throwSupabaseError(
          `Unable to read Cadence user ${actor.userId}`,
          error,
        );
      }

      if (data && authUserId !== null && data.auth_user_id !== authUserId) {
        throw new Error(
          `Conflicting deterministic Cadence user ${actor.userId}.`,
        );
      }

      if (data && authUserId === null) {
        throw new Error(
          `Cadence user ${actor.userId} has no matching Auth user.`,
        );
      }

      return data as Record<string, unknown> | null;
    },
  };
}


export async function preflightFixtureActors(
  store: ActorPreflightStore,
): Promise<void> {
  for (const actor of Object.values(
    VS003_RUNTIME_FIXTURE.actors,
  ) as RuntimeActor[]) {
    const authUser = await store.readAuthUser(actor);
    const activeIdentities = await store.readActiveIdentities(actor);

    if (activeIdentities.length > 1) {
      throw new Error(
        `Conflicting multiple active authentication identities for ${actor.email}.`,
      );
    }

    const person = await store.readPerson(actor);
    if (person && (
      person.id !== actor.personId ||
      person.display_name !== actor.displayName
    )) {
      throw new Error(
        `Conflicting deterministic Person ${actor.personId}.`,
      );
    }

    const cadenceUser = await store.readCadenceUser(
      actor,
      authUser?.id ?? null,
    );
    if (cadenceUser && (
      cadenceUser.id !== actor.userId ||
      cadenceUser.auth_user_id !== authUser?.id ||
      cadenceUser.person_id !== actor.personId ||
      cadenceUser.username !== actor.username ||
      cadenceUser.display_name !== actor.displayName ||
      cadenceUser.email !== actor.email ||
      cadenceUser.status !== "active" ||
      cadenceUser.identity_provider !== "local"
    )) {
      throw new Error(
        `Conflicting deterministic Cadence user ${actor.userId}.`,
      );
    }

    const identity = activeIdentities[0];
    if (identity) {
      if (!authUser) {
        throw new Error(
          `Authentication identity for ${actor.email} has no matching Auth user.`,
        );
      }

      assertDeterministicIdentity(
        {
          id: identity.id as string,
          authUserId: authUser.id,
          personId: identity.person_id as string,
          provider: identity.provider as string,
          providerSubjectId: identity.provider_subject_id as string,
          loginIdentifier: identity.login_identifier as string,
          validFrom: identity.valid_from as string,
          validTo: identity.valid_to as string | null,
          status: identity.status as string,
        },
        {
          id: authUser.id,
          authUserId: authUser.id,
          personId: actor.personId,
          provider: "local",
          providerSubjectId: authUser.id,
          loginIdentifier: actor.email,
          validFrom: BASELINE_AT,
          validTo: null,
          status: "ACTIVE",
        },
      );
    }
  }
}


export async function reconcileFixtureActors(
  store: ActorPreflightStore,
  reconcileActor: (actor: RuntimeActor) => Promise<void>,
): Promise<void> {
  await preflightFixtureActors(store);

  for (const actor of Object.values(
    VS003_RUNTIME_FIXTURE.actors,
  ) as RuntimeActor[]) {
    await reconcileActor(actor);
  }
}


async function ensureAuthUser(
  admin: SupabaseClient,
  actor: RuntimeActor,
  password: string,
): Promise<string> {
  const existing = await findAuthUser(
    admin,
    actor.email,
  );

  const metadata = {
    ...(existing?.user_metadata ?? {}),
    cadence_local_development: true,
    vs003_runtime_fixture: true,
  };

  if (existing) {
    const { error } =
      await admin.auth.admin.updateUserById(
        existing.id,
        {
          password,
          user_metadata: metadata,
        },
      );

    if (error) {
      throwSupabaseError(
        `Unable to reconcile local Supabase Auth user ${actor.email}`,
        error,
      );
    }

    return existing.id;
  }

  const { data, error } =
    await admin.auth.admin.createUser({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

  if (error || !data.user) {
    throwSupabaseError(
      `Unable to create local Supabase Auth user ${actor.email}`,
      error,
    );
  }

  return data.user.id;
}


async function ensurePerson(
  admin: SupabaseClient,
  actor: RuntimeActor,
): Promise<void> {
  const { data, error } =
    await admin
      .from("persons")
      .select("id, display_name")
      .eq("id", actor.personId)
      .maybeSingle();

  if (error) {
    throwSupabaseError(
      `Unable to read Person ${actor.personId}`,
      error,
    );
  }

  if (data) {
    if (
      data.id !== actor.personId ||
      data.display_name !== actor.displayName
    ) {
      throw new Error(
        `Conflicting deterministic Person ${actor.personId}.`,
      );
    }

    return;
  }

  const { error: insertError } =
    await admin.from("persons").insert({
      id: actor.personId,
      display_name: actor.displayName,
    });

  if (insertError) {
    throwSupabaseError(
      `Unable to create Person ${actor.personId}`,
      insertError,
    );
  }
}


async function ensureCadenceUser(
  admin: SupabaseClient,
  actor: RuntimeActor,
  authUserId: string,
): Promise<void> {
  const { data: authOwner, error: authOwnerError } =
    await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

  if (authOwnerError) {
    throwSupabaseError(
      `Unable to verify Cadence Auth mapping for ${actor.email}`,
      authOwnerError,
    );
  }

  if (authOwner && authOwner.id !== actor.userId) {
    throw new Error(
      `Auth user ${authUserId} is mapped to a conflicting Cadence user.`,
    );
  }

  const { data, error } =
    await admin
      .from("users")
      .select(
        "id, auth_user_id, person_id, username, display_name, email, status, identity_provider",
      )
      .eq("id", actor.userId)
      .maybeSingle();

  if (error) {
    throwSupabaseError(
      `Unable to read Cadence user ${actor.userId}`,
      error,
    );
  }

  if (data) {
    const exact =
      data.auth_user_id === authUserId &&
      data.person_id === actor.personId &&
      data.username === actor.username &&
      data.display_name === actor.displayName &&
      data.email === actor.email &&
      data.status === "active" &&
      data.identity_provider === "local";

    if (!exact) {
      throw new Error(
        `Conflicting deterministic Cadence user ${actor.userId}.`,
      );
    }

    return;
  }

  const { error: insertError } =
    await admin.from("users").insert({
      id: actor.userId,
      auth_user_id: authUserId,
      person_id: actor.personId,
      username: actor.username,
      display_name: actor.displayName,
      email: actor.email,
      status: "active",
      identity_provider: "local",
      external_user_id: null,
    });

  if (insertError) {
    throwSupabaseError(
      `Unable to create Cadence user ${actor.userId}`,
      insertError,
    );
  }
}


export async function ensureAuthenticationIdentity(
  admin: SupabaseClient,
  actor: RuntimeActor,
  authUserId: string,
): Promise<void> {
  const { data, error } =
    await admin
      .from("authentication_identities")
      .select(
        "id, person_id, provider, provider_subject_id, login_identifier, valid_from, valid_to, status",
      )
      .eq("person_id", actor.personId)
      .eq("status", "ACTIVE");

  if (error) {
    throwSupabaseError(
      `Unable to read authentication identities for ${actor.personId}`,
      error,
    );
  }

  const activeIdentities = data ?? [];

  if (activeIdentities.length > 1) {
    throw new Error(
      `Conflicting multiple active authentication identities for ${actor.email}.`,
    );
  }

  if (
    activeIdentities.some(
      (identity) =>
        identity.provider !== "local" ||
        identity.provider_subject_id !== authUserId,
    )
  ) {
    throw new Error(
      `Conflicting active authentication identity for ${actor.email}.`,
    );
  }

  const existing = activeIdentities[0];

  if (existing) {
    assertDeterministicIdentity(
      {
        id: existing.id,
        authUserId,
        personId: existing.person_id,
        provider: existing.provider,
        providerSubjectId: existing.provider_subject_id,
        loginIdentifier: existing.login_identifier,
        validFrom: existing.valid_from,
        validTo: existing.valid_to,
        status: existing.status,
      },
      {
        id: authUserId,
        authUserId,
        personId: actor.personId,
        provider: "local",
        providerSubjectId: authUserId,
        loginIdentifier: actor.email,
        validFrom: BASELINE_AT,
        validTo: null,
        status: "ACTIVE",
      },
    );

    return;
  }

  const { error: insertError } =
    await admin
      .from("authentication_identities")
      .insert({
        id: authUserId,
        person_id: actor.personId,
        provider: "local",
        provider_subject_id: authUserId,
        login_identifier: actor.email,
        valid_from: BASELINE_AT,
        valid_to: null,
        status: "ACTIVE",
      });

  if (insertError) {
    throwSupabaseError(
      `Unable to create authentication identity for ${actor.email}`,
      insertError,
    );
  }
}


async function ensureProject(
  admin: SupabaseClient,
  project: RuntimeProject,
): Promise<void> {
  const { data, error } =
    await admin
      .from("projects")
      .select(
        "id, name, description, goal, lifecycle_status, progress_percent, owner_user_id, start_date, target_date",
      )
      .eq("id", project.id)
      .maybeSingle();

  if (error) {
    throwSupabaseError(
      `Unable to read project ${project.id}`,
      error,
    );
  }

  if (data) {
    assertDeterministicProjectState(
      { ...data, marker: data.name },
      {
      id: project.id,
      name: project.name,
      description: project.description,
      goal: project.goal,
      marker: project.marker,
      lifecycle_status: "active",
      progress_percent: 0,
      owner_user_id: project.ownerUserId,
      start_date: "2026-01-01",
      target_date: null,
      },
    );

    return;
  }

  const { error: insertError } =
    await admin.from("projects").insert({
      id: project.id,
      name: project.name,
      description: project.description,
      goal: project.goal,
      lifecycle_status: "active",
      progress_percent: 0,
      owner_user_id: project.ownerUserId,
      start_date: "2026-01-01",
      target_date: null,
    });

  if (insertError) {
    throwSupabaseError(
      `Unable to create project ${project.id}`,
      insertError,
    );
  }
}


async function ensureProjectHealth(
  admin: SupabaseClient,
  project: RuntimeProject,
): Promise<void> {
  const { data, error } =
    await admin
      .from("project_health")
      .select("project_id, health_status, reasons, source, changed_by")
      .eq("project_id", project.id)
      .maybeSingle();

  if (error) {
    throwSupabaseError(
      `Unable to read project health for ${project.id}`,
      error,
    );
  }

  const action =
    planProjectHealthReconciliation(
      data
        ? {
            healthStatus: data.health_status,
            reasons: data.reasons,
            source: data.source,
            changedBy: data.changed_by,
          }
        : null,
    );

  if (action === "reuse") {
    assertDeterministicProjectHealth(
      data as Record<string, unknown>,
      {
        project_id: project.id,
        health_status: "on_track",
        reasons: [],
        source: "system",
        changed_by: null,
      },
    );
    return;
  }

  const { error: insertError } =
    await admin.from("project_health").insert({
      project_id: project.id,
      health_status: "on_track",
      reasons: [],
      source: "system",
      changed_by: null,
    });

  if (insertError) {
    throwSupabaseError(
      `Unable to create project health for ${project.id}`,
      insertError,
    );
  }
}


type ExistingMembership = {
  id: string;
  project_id: string;
  person_id: string;
  effective_from: string;
  effective_to: string | null;
  membership_status: string;
  granted_by_person_id: string;
};


type ExistingAssignment = {
  id: string;
  project_id: string;
  membership_id: string;
  role: string;
  effective_from: string;
  effective_to: string | null;
  assigned_by_person_id: string;
  change_reason: string | null;
  created_at: string;
};


export type MembershipStore = {
  readMembership: (spec: MembershipSpec) => Promise<ExistingMembership | null>;
  readAssignments: (spec: MembershipSpec) => Promise<ExistingAssignment[]>;
  readEvents: (spec: MembershipSpec) => Promise<FixtureEvent[]>;
  addProjectMember: (spec: MembershipSpec) => Promise<void>;
  changeOrdinaryRole: (spec: MembershipSpec) => Promise<void>;
};


export type MembershipTransitionAction =
  | "CREATE_MEMBER"
  | "CREATE_AND_TRANSITION"
  | "TRANSITION_ROLE"
  | "NOOP";


type MembershipStateSnapshot = {
  membership: ExistingMembership | null;
  assignments: readonly ExistingAssignment[];
  events: readonly FixtureEvent[];
};


export type MembershipTransitionPlan = {
  spec: MembershipSpec;
  action: MembershipTransitionAction;
  state: MembershipStateSnapshot;
};


async function readMembership(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<ExistingMembership | null> {
  const { data, error } =
    await admin
      .from("project_memberships")
      .select(
        "id, project_id, person_id, effective_from, effective_to, membership_status, granted_by_person_id",
      )
      .eq("id", spec.membershipId)
      .maybeSingle();

  if (error) {
    throwSupabaseError(
      `Unable to read membership ${spec.membershipId}`,
      error,
    );
  }

  return data as ExistingMembership | null;
}


async function readAssignments(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<ExistingAssignment[]> {
  const { data, error } =
    await admin
      .from("project_role_assignments")
      .select(
        "id, project_id, membership_id, role, effective_from, effective_to, assigned_by_person_id, change_reason, created_at",
      )
      .eq("membership_id", spec.membershipId)
      .eq("project_id", spec.projectId)
      .order("effective_from", { ascending: true });

  if (error) {
    throwSupabaseError(
      `Unable to read role assignments for ${spec.membershipId}`,
      error,
    );
  }

  return (data ?? []) as ExistingAssignment[];
}


async function readEvents(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<FixtureEvent[]> {
  const correlations = [
    spec.correlationId,
    ...(spec.roleChangeCorrelationId
      ? [spec.roleChangeCorrelationId]
      : []),
  ];
  const { data, error } = await admin
    .from("domain_events")
    .select(
      "id, event_type, event_version, aggregate_type, aggregate_id, project_id, actor_type, actor_id, payload, correlation_id, occurred_at",
    )
    .in("correlation_id", correlations);

  if (error) {
    throwSupabaseError(
      `Unable to read fixture domain events for ${spec.membershipId}`,
      error,
    );
  }

  return (data ?? []) as FixtureEvent[];
}


function assertMembershipExact(
  membership: ExistingMembership,
  spec: MembershipSpec,
): void {
  if (
    membership.id !== spec.membershipId ||
    membership.project_id !== spec.projectId ||
    membership.person_id !== spec.personId ||
    !timestampsEqual(
      membership.effective_from,
      BASELINE_AT,
    ) ||
    membership.effective_to !== null ||
    membership.membership_status !== "ACTIVE" ||
    membership.granted_by_person_id !== spec.grantorPersonId
  ) {
    throw new Error(
      `Conflicting deterministic membership ${spec.membershipId}.`,
    );
  }
}


export function assertAssignmentHistoryExact(
  actual: readonly Record<string, unknown>[],
  expected: readonly Record<string, unknown>[],
): void {
  if (actual.length !== expected.length) {
    throw new Error("conflicting deterministic role assignment set.");
  }

  const actualById = new Map(
    actual.map((assignment) => [assignment.id, assignment]),
  );

  for (const expectedAssignment of expected) {
    const persisted = actualById.get(expectedAssignment.id);
    if (!persisted) {
      throw new Error("conflicting deterministic role assignment set.");
    }

    const timestampFields = [
      "effective_from",
      "effective_to",
      "created_at",
    ];
    const fields = [
      "id",
      "project_id",
      "membership_id",
      "role",
      "assigned_by_person_id",
      "change_reason",
    ];

    if (
      fields.some((field) => persisted[field] !== expectedAssignment[field]) ||
      timestampFields.some((field) =>
        field === "effective_to"
          ? !timestampsEqualNullable(
              persisted[field] as string | null,
              expectedAssignment[field] as string | null,
            )
          : !timestampsEqual(
              persisted[field] as string,
              expectedAssignment[field] as string,
            ),
      )
    ) {
      throw new Error("conflicting deterministic role assignment set.");
    }
  }
}


type FixtureEvent = Record<string, unknown>;


function expectedEvent(
  spec: MembershipSpec,
  correlationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): FixtureEvent {
  return {
    event_type: eventType,
    event_version: 1,
    aggregate_type: "project_membership",
    aggregate_id: spec.membershipId,
    project_id: spec.projectId,
    actor_type: "person",
    actor_id: spec.grantorPersonId,
    correlation_id: correlationId,
    occurred_at:
      correlationId === spec.correlationId
        ? BASELINE_AT
        : ROLE_CHANGE_AT,
    payload,
  };
}


const DETERMINISTIC_EVENT_TIMESTAMP_PATHS = new Set([
  "effective_at",
  "after.effective_from",
  "after.effective_to",
  "after.created_at",
  "initial_role_assignment.effective_from",
  "initial_role_assignment.effective_to",
  "initial_role_assignment.created_at",
]);


function payloadContains(
  actual: unknown,
  expected: unknown,
  path = "",
): boolean {
  if (DETERMINISTIC_EVENT_TIMESTAMP_PATHS.has(path)) {
    return timestampsEqualNullable(
      actual as string | null,
      expected as string | null,
    );
  }

  if (
    expected === null ||
    typeof expected !== "object"
  ) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  if (!actual || typeof actual !== "object") {
    return false;
  }

  return Object.entries(expected as Record<string, unknown>).every(
    ([key, value]) =>
      payloadContains(
        (actual as Record<string, unknown>)[key],
        value,
        path ? `${path}.${key}` : key,
      ),
  );
}


export function assertVs003DomainEventsExact(
  actual: readonly FixtureEvent[],
  expected: readonly FixtureEvent[],
): void {
  const expectedByCorrelation = new Map<string, FixtureEvent[]>();
  for (const item of expected) {
    const correlationId = item.correlation_id as string;
    const group = expectedByCorrelation.get(correlationId) ?? [];
    group.push(item);
    expectedByCorrelation.set(correlationId, group);
  }

  const actualByCorrelation = new Map<string, FixtureEvent[]>();
  for (const item of actual) {
    const correlationId = item.correlation_id as string;
    if (!expectedByCorrelation.has(correlationId)) {
      continue;
    }
    const group = actualByCorrelation.get(correlationId) ?? [];
    group.push(item);
    actualByCorrelation.set(correlationId, group);
  }

  for (const [correlationId, expectedGroup] of expectedByCorrelation) {
    const actualGroup = actualByCorrelation.get(correlationId) ?? [];
    if (actualGroup.length !== expectedGroup.length) {
      throw new Error("conflicting deterministic fixture event set.");
    }

    for (const expectedEvent of expectedGroup) {
      const matches = actualGroup.filter((actualEvent) =>
        Object.entries(expectedEvent).every(([key, value]) =>
          key === "payload"
            ? payloadContains(actualEvent[key], value)
            : key === "occurred_at"
              ? timestampsEqual(
                  actualEvent[key] as string,
                  value as string,
                )
            : actualEvent[key] === value,
        ),
      );

      if (matches.length !== 1) {
        throw new Error("conflicting deterministic fixture event.");
      }
    }
  }
}


function parseFixtureTimestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number(match[7] ?? "0");
  const timezone = match[8];
  const offsetHours = timezone === "Z" ? 0 : Number(timezone.slice(1, 3));
  const offsetMinutes = timezone === "Z" ? 0 : Number(timezone.slice(4, 6));

  const leapYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  if (
    month < 1 || month > 12 ||
    day < 1 || day > (daysInMonth ?? 0) ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHours > 23 || offsetMinutes > 59
  ) {
    return null;
  }

  const instant = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, milliseconds),
  );
  if (year < 100) {
    instant.setUTCFullYear(year);
  }

  const offset = offsetHours * 60 + offsetMinutes;
  return instant.getTime() - offset * 60_000;
}


function timestampsEqual(
  actual: string,
  expected: string,
): boolean {
  const actualInstant = parseFixtureTimestamp(actual);
  const expectedInstant = parseFixtureTimestamp(expected);

  return (
    actualInstant !== null &&
    expectedInstant !== null &&
    actualInstant === expectedInstant
  );
}


function timestampsEqualNullable(
  actual: string | null,
  expected: string | null,
): boolean {
  if (actual === null || expected === null) {
    return actual === expected;
  }

  return timestampsEqual(actual, expected);
}


const ORDINARY_ROLE_CHANGE_REASON =
  "VS003 local runtime fixture role shape";


export function expectedAssignmentHistory(
  spec: MembershipSpec,
  includeReplacement: boolean,
): Record<string, unknown>[] {
  const assignments: Record<string, unknown>[] = [
    {
      id: spec.initialAssignmentId,
      project_id: spec.projectId,
      membership_id: spec.membershipId,
      role: "PROJECT_MEMBER",
      effective_from: BASELINE_AT,
      effective_to: includeReplacement ? ROLE_CHANGE_AT : null,
      assigned_by_person_id: spec.grantorPersonId,
      change_reason: null,
      created_at: BASELINE_AT,
    },
  ];

  if (includeReplacement && spec.targetAssignmentId) {
    assignments.push({
      id: spec.targetAssignmentId,
      project_id: spec.projectId,
      membership_id: spec.membershipId,
      role: spec.targetRole,
      effective_from: ROLE_CHANGE_AT,
      effective_to: null,
      assigned_by_person_id: spec.grantorPersonId,
      change_reason: ORDINARY_ROLE_CHANGE_REASON,
      created_at: ROLE_CHANGE_AT,
    });
  }

  return assignments;
}


async function admitMembership(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<void> {
  const { data, error } =
    await admin.rpc("add_project_member", {
      p_membership_id: spec.membershipId,
      p_project_id: spec.projectId,
      p_person_id: spec.personId,
      p_effective_from: BASELINE_AT,
      p_effective_to: null,
      p_granted_by_person_id: spec.grantorPersonId,
      p_membership_created_at: BASELINE_AT,
      p_role_assignment_id: spec.initialAssignmentId,
      p_assigned_by_person_id: spec.grantorPersonId,
      p_role_created_at: BASELINE_AT,
      p_correlation_id: spec.correlationId,
    });

  if (error || !data?.[0]) {
    throwSupabaseError(
      `Unable to admit membership ${spec.membershipId}`,
      error,
    );
  }
}


async function changeOrdinaryRole(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<void> {
  if (
    !spec.targetAssignmentId ||
    !spec.roleChangeCorrelationId
  ) {
    return;
  }

  const { data, error } =
    await admin.rpc("change_project_ordinary_role", {
      p_assignment_id: spec.targetAssignmentId,
      p_project_id: spec.projectId,
      p_membership_id: spec.membershipId,
      p_role: spec.targetRole,
      p_effective_at: ROLE_CHANGE_AT,
      p_assigned_by_person_id: spec.grantorPersonId,
      p_change_reason: ORDINARY_ROLE_CHANGE_REASON,
      p_correlation_id: spec.roleChangeCorrelationId,
      p_created_at: ROLE_CHANGE_AT,
    });

  if (error || !data?.[0]) {
    throwSupabaseError(
      `Unable to assign ${spec.targetRole} for ${spec.membershipId}`,
      error,
    );
  }
}


function createMembershipStore(admin: SupabaseClient): MembershipStore {
  return {
    readMembership: (spec) => readMembership(admin, spec),
    readAssignments: (spec) => readAssignments(admin, spec),
    readEvents: (spec) => readEvents(admin, spec),
    addProjectMember: (spec) => admitMembership(admin, spec),
    changeOrdinaryRole: (spec) => changeOrdinaryRole(admin, spec),
  };
}


function expectedMembershipState(
  spec: MembershipSpec,
): {
  admissionAssignments: readonly Record<string, unknown>[];
  finalAssignments: readonly Record<string, unknown>[];
  admissionEvents: readonly FixtureEvent[];
  finalEvents: readonly FixtureEvent[];
} {
  const admissionAssignments = expectedAssignmentHistory(spec, false);
  const finalAssignments = expectedAssignmentHistory(spec, true);
  const admissionEvents = expectedVs003Events().filter(
    (event) => event.correlation_id === spec.correlationId,
  );
  const finalEvents = expectedVs003Events().filter(
    (event) =>
      event.correlation_id === spec.correlationId ||
      event.correlation_id === spec.roleChangeCorrelationId,
  );

  return {
    admissionAssignments,
    finalAssignments,
    admissionEvents,
    finalEvents,
  };
}


function assertNoRoleChangeEvents(
  events: readonly FixtureEvent[],
  spec: MembershipSpec,
): void {
  if (
    spec.roleChangeCorrelationId &&
    events.some(
      (event) => event.correlation_id === spec.roleChangeCorrelationId,
    )
  ) {
    throw new Error(
      `Conflicting deterministic VS003 role-change history ${spec.membershipId}.`,
    );
  }
}


function assertAdmissionState(
  state: MembershipStateSnapshot,
  spec: MembershipSpec,
): void {
  const {
    admissionAssignments,
    admissionEvents,
  } = expectedMembershipState(spec);

  if (!state.membership) {
    throw new Error(
      `Membership ${spec.membershipId} was not readable after admission.`,
    );
  }

  assertMembershipExact(state.membership, spec);
  assertAssignmentHistoryExact(
    state.assignments as unknown as Record<string, unknown>[],
    admissionAssignments,
  );
  assertVs003DomainEventsExact(state.events, admissionEvents);
}


function assertFinalState(
  state: MembershipStateSnapshot,
  spec: MembershipSpec,
): void {
  const { finalAssignments, finalEvents } = expectedMembershipState(spec);

  if (!state.membership) {
    throw new Error(
      `Membership ${spec.membershipId} was not readable after role change.`,
    );
  }

  assertMembershipExact(state.membership, spec);
  assertAssignmentHistoryExact(
    state.assignments as unknown as Record<string, unknown>[],
    finalAssignments,
  );
  assertVs003DomainEventsExact(state.events, finalEvents);
}


function classifyMembershipState(
  state: MembershipStateSnapshot,
  spec: MembershipSpec,
): MembershipTransitionAction {
  const {
    admissionAssignments,
    finalAssignments,
    admissionEvents,
    finalEvents,
  } = expectedMembershipState(spec);

  if (!state.membership) {
    if (state.assignments.length !== 0 || state.events.length !== 0) {
      throw new Error(
        `Conflicting partial VS003 membership state ${spec.membershipId}.`,
      );
    }

    return spec.targetAssignmentId
      ? "CREATE_AND_TRANSITION"
      : "CREATE_MEMBER";
  }

  assertMembershipExact(state.membership, spec);

  if (!spec.targetAssignmentId) {
    assertAssignmentHistoryExact(
      state.assignments as unknown as Record<string, unknown>[],
      admissionAssignments,
    );
    assertVs003DomainEventsExact(state.events, admissionEvents);
    return "NOOP";
  }

  try {
    assertAssignmentHistoryExact(
      state.assignments as unknown as Record<string, unknown>[],
      finalAssignments,
    );
    assertVs003DomainEventsExact(state.events, finalEvents);
    return "NOOP";
  } catch {
    // Continue with the only permitted transitionable state below.
  }

  try {
    assertAssignmentHistoryExact(
      state.assignments as unknown as Record<string, unknown>[],
      admissionAssignments,
    );
    assertVs003DomainEventsExact(state.events, admissionEvents);
    assertNoRoleChangeEvents(state.events, spec);
  } catch {
    throw new Error(
      `Conflicting deterministic VS003 membership state ${spec.membershipId}.`,
    );
  }

  return "TRANSITION_ROLE";
}


export async function preflightFixtureMemberships(
  store: MembershipStore,
  specs: readonly MembershipSpec[] = VS003_RUNTIME_MEMBERSHIP_SPECS,
): Promise<readonly MembershipTransitionPlan[]> {
  const plans: MembershipTransitionPlan[] = [];

  for (const spec of specs) {
    const state: MembershipStateSnapshot = {
      membership: await store.readMembership(spec),
      assignments: await store.readAssignments(spec),
      events: await store.readEvents(spec),
    };

    plans.push(Object.freeze({
      spec: Object.freeze({ ...spec }),
      action: classifyMembershipState(state, spec),
      state: Object.freeze({
        membership: state.membership,
        assignments: Object.freeze([...state.assignments]),
        events: Object.freeze([...state.events]),
      }),
    }));
  }

  return Object.freeze(plans);
}


async function executeMembershipTransition(
  store: MembershipStore,
  plan: MembershipTransitionPlan,
): Promise<void> {
  const { spec, action } = plan;

  if (action === "NOOP") {
    return;
  }

  if (action === "TRANSITION_ROLE") {
    await store.changeOrdinaryRole(spec);
    const state: MembershipStateSnapshot = {
      membership: await store.readMembership(spec),
      assignments: await store.readAssignments(spec),
      events: await store.readEvents(spec),
    };
    assertFinalState(state, spec);
    return;
  }

  await store.addProjectMember(spec);
  const admissionState: MembershipStateSnapshot = {
    membership: await store.readMembership(spec),
    assignments: await store.readAssignments(spec),
    events: await store.readEvents(spec),
  };
  assertAdmissionState(admissionState, spec);

  if (action === "CREATE_MEMBER") {
    return;
  }

  await store.changeOrdinaryRole(spec);
  const finalState: MembershipStateSnapshot = {
    membership: await store.readMembership(spec),
    assignments: await store.readAssignments(spec),
    events: await store.readEvents(spec),
  };
  assertFinalState(finalState, spec);
}


export async function ensureMembershipWithStore(
  store: MembershipStore,
  spec: MembershipSpec,
): Promise<void> {
  const [plan] = await preflightFixtureMemberships(store, [spec]);
  await executeMembershipTransition(store, plan);
}


async function ensureMembership(
  admin: SupabaseClient,
  spec: MembershipSpec,
): Promise<void> {
  return ensureMembershipWithStore(createMembershipStore(admin), spec);
}


export async function reconcileFixtureMembershipsWithStore(
  store: MembershipStore,
): Promise<void> {
  const plans = await preflightFixtureMemberships(store);

  for (const plan of plans) {
    await executeMembershipTransition(store, plan);
  }
}


export function expectedVs003Events(): FixtureEvent[] {
  const events: FixtureEvent[] = [];

  for (const spec of VS003_RUNTIME_MEMBERSHIP_SPECS) {
    events.push(
      expectedEvent(
        spec,
        spec.correlationId,
        "ProjectMemberAdded",
        {
          project_id: spec.projectId,
          membership_id: spec.membershipId,
          affected_person_id: spec.personId,
          effective_at: BASELINE_AT,
          reason: null,
          initial_role_assignment: {
            assignment_id: spec.initialAssignmentId,
            project_id: spec.projectId,
            membership_id: spec.membershipId,
            role: "PROJECT_MEMBER",
            effective_from: BASELINE_AT,
            effective_to: null,
            assigned_by_person_id: spec.grantorPersonId,
            change_reason: null,
            created_at: BASELINE_AT,
          },
        },
      ),
      expectedEvent(
        spec,
        spec.correlationId,
        "ProjectRoleAssigned",
        {
          project_id: spec.projectId,
          membership_id: spec.membershipId,
          affected_person_id: spec.personId,
          assignment_kind: "INITIAL_ORDINARY",
          effective_at: BASELINE_AT,
          reason: null,
          previous_assignment_id: null,
          after: {
            assignment_id: spec.initialAssignmentId,
            project_id: spec.projectId,
            membership_id: spec.membershipId,
            role: "PROJECT_MEMBER",
            effective_from: BASELINE_AT,
            effective_to: null,
            assigned_by_person_id: spec.grantorPersonId,
            change_reason: null,
            created_at: BASELINE_AT,
          },
          transfer: null,
        },
      ),
    );

    if (spec.roleChangeCorrelationId) {
      events.push(
        expectedEvent(
          spec,
          spec.roleChangeCorrelationId,
          "ProjectRoleRevoked",
          {
            project_id: spec.projectId,
            membership_id: spec.membershipId,
            affected_person_id: spec.personId,
            revocation_kind: "ORDINARY_REPLACEMENT",
            effective_at: ROLE_CHANGE_AT,
            reason: ORDINARY_ROLE_CHANGE_REASON,
            successor_assignment_id: spec.targetAssignmentId,
            after: {
              assignment_id: spec.initialAssignmentId,
              project_id: spec.projectId,
              membership_id: spec.membershipId,
              role: "PROJECT_MEMBER",
              effective_from: BASELINE_AT,
              effective_to: ROLE_CHANGE_AT,
              assigned_by_person_id: spec.grantorPersonId,
              change_reason: null,
              created_at: BASELINE_AT,
            },
          },
        ),
        expectedEvent(
          spec,
          spec.roleChangeCorrelationId,
          "ProjectRoleAssigned",
          {
            project_id: spec.projectId,
            membership_id: spec.membershipId,
            affected_person_id: spec.personId,
            assignment_kind: "ORDINARY_CHANGE",
            effective_at: ROLE_CHANGE_AT,
            reason: ORDINARY_ROLE_CHANGE_REASON,
            previous_assignment_id: spec.initialAssignmentId,
            after: {
              assignment_id: spec.targetAssignmentId,
              project_id: spec.projectId,
              membership_id: spec.membershipId,
              role: spec.targetRole,
              effective_from: ROLE_CHANGE_AT,
              effective_to: null,
              assigned_by_person_id: spec.grantorPersonId,
              change_reason: ORDINARY_ROLE_CHANGE_REASON,
              created_at: ROLE_CHANGE_AT,
            },
            transfer: null,
          },
        ),
      );
    }
  }

  return events;
}


async function reconcileVs003DomainEvents(
  admin: SupabaseClient,
): Promise<void> {
  const expected = expectedVs003Events();
  const correlationIds = [
    ...new Set(
      expected.map((event) => event.correlation_id as string),
    ),
  ];
  const { data, error } = await admin
    .from("domain_events")
    .select(
      "id, event_type, event_version, aggregate_type, aggregate_id, project_id, actor_type, actor_id, payload, correlation_id, occurred_at",
    )
    .in("correlation_id", correlationIds);

  if (error) {
    throwSupabaseError(
      "Unable to read VS003 fixture domain events",
      error,
    );
  }

  assertVs003DomainEventsExact(
    (data ?? []) as FixtureEvent[],
    expected,
  );
}


async function verifyPublishableSignIn(
  url: string,
  publishableKey: string,
  actor: RuntimeActor,
  password: string,
  expectedAuthUserId: string,
): Promise<void> {
  const browserClient = createClient(
    url,
    publishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } =
    await browserClient.auth.signInWithPassword({
      email: actor.email,
      password,
    });

  if (error || !data.session) {
    throwSupabaseError(
      `Local publishable-key sign-in failed for ${actor.email}`,
      error,
    );
  }

  const { data: userData, error: userError } =
    await browserClient.auth.getUser(
      data.session.access_token,
    );

  if (
    userError ||
    !userData.user ||
    userData.user.id !== expectedAuthUserId
  ) {
    throwSupabaseError(
      `Local publishable-key identity verification failed for ${actor.email}`,
      userError,
    );
  }

  await browserClient.auth.signOut();
}


function getActorPasswordName(
  actorKey: FixtureActorKey,
): string {
  const names: Record<FixtureActorKey, string> = {
    userA: "CADENCE_VS003_USER_A_PASSWORD",
    userB: "CADENCE_VS003_USER_B_PASSWORD",
    observer: "CADENCE_VS003_OBSERVER_PASSWORD",
    auditor: "CADENCE_VS003_AUDITOR_PASSWORD",
    nonmember: "CADENCE_VS003_NONMEMBER_PASSWORD",
  };

  return names[actorKey];
}


async function main(): Promise<void> {
  const admin = getAdminClient();
  const fixturePasswords = Object.fromEntries(
    REQUIRED_VS003_PASSWORDS.map((name) => [name, process.env[name]]),
  );
  assertVs003LocalPasswords(fixturePasswords);
  const supabaseUrl =
    requireEnvironmentValue("SUPABASE_URL");
  const publishableKey =
    requireEnvironmentValue(
      "SUPABASE_PUBLISHABLE_KEY",
    );

  const authUserIds = new Map<string, string>();

  await reconcileFixtureActors(
    createActorPreflightStore(admin),
    async (actor) => {
      const passwordName = getActorPasswordName(
        actor.key as FixtureActorKey,
      );
      const password = requireLocalPassword(passwordName);
      const authUserId = await ensureAuthUser(
        admin,
        actor,
        password,
      );

      await ensurePerson(admin, actor);
      await ensureCadenceUser(admin, actor, authUserId);
      await ensureAuthenticationIdentity(admin, actor, authUserId);
      authUserIds.set(actor.key, authUserId);
    },
  );

  await ensureProject(
    admin,
    VS003_RUNTIME_FIXTURE.projects.p1,
  );
  await ensureProjectHealth(
    admin,
    VS003_RUNTIME_FIXTURE.projects.p1,
  );
  await ensureProject(
    admin,
    VS003_RUNTIME_FIXTURE.projects.p2,
  );
  await ensureProjectHealth(
    admin,
    VS003_RUNTIME_FIXTURE.projects.p2,
  );

  await reconcileFixtureMembershipsWithStore(createMembershipStore(admin));

  await reconcileVs003DomainEvents(admin);

  for (const actor of Object.values(
    VS003_RUNTIME_FIXTURE.actors,
  ) as readonly RuntimeActor[]) {
    await verifyPublishableSignIn(
      supabaseUrl,
      publishableKey,
      actor,
      requireLocalPassword(
        getActorPasswordName(
          actor.key as FixtureActorKey,
        ),
      ),
      authUserIds.get(actor.key) ?? "",
    );
  }

  console.log(
    "VS003 local runtime fixture bootstrap passed.",
  );
  console.log(
    `P1: ${VS003_RUNTIME_FIXTURE.projects.p1.id}`,
  );
  console.log(
    `P2: ${VS003_RUNTIME_FIXTURE.projects.p2.id}`,
  );
  console.log("Actors reconciled: 5");
  console.log("Publishable sign-in verification: 5/5");
}


if (require.main === module) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `VS003 local runtime fixture bootstrap failed: ${message}`,
    );
    process.exitCode = 1;
  });
}
