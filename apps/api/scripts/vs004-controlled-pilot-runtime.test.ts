import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdministrativeAuthProvider,
} from "../src/infrastructure/auth/administrative-auth-provider";
import type {
  AuthenticationIdentity,
  CadencePerson,
} from "../src/modules/identity/identity.types";
import type {
  PilotCadenceUserRecord,
  PilotIdentityPreparationIntent,
} from "../src/modules/identity/pilot-preparation.types";
import type {
  PilotProjectHealthRecord,
} from "../src/modules/project-health/pilot-preparation.types";
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
  PilotProjectRecord,
} from "../src/modules/projects/pilot-preparation.types";
import type {
  ControlledPilotObservationSources,
} from "./vs004-controlled-pilot-preflight";
import type {
  ControlledPilotExecutionServices,
} from "./vs004-controlled-pilot-execution";
import type {
  ControlledPilotRuntimeConfiguration,
} from "./vs004-controlled-pilot-runtime-config";
import {
  buildControlledPilotExecutionServices,
  buildControlledPilotObservationRuntime,
  type ControlledPilotRuntimeFactories,
} from "./vs004-controlled-pilot-runtime";


const projectId = "00740000-0000-4000-8000-000000000001";
const operatorPersonId = "00741000-0000-4000-8000-000000000001";
const secret = "secret-that-must-not-leak";
const password = "password-that-must-not-leak";

const client = { marker: "private-client" } as unknown as SupabaseClient;
const authProvider = {
  findAccounts: async () => [],
  createAccount: async () => {
    throw new Error("not used");
  },
} as unknown as AdministrativeAuthProvider;

const observationSources = {
  auth: { findAccounts: async () => [] },
  identity: {
    findPersonById: async (): Promise<CadencePerson | null> => null,
    findCadenceUserById: async (): Promise<PilotCadenceUserRecord | null> => null,
    listAuthenticationIdentities: async (): Promise<AuthenticationIdentity[]> => [],
    findAuthenticationIdentitiesByProviderSubject: async (): Promise<AuthenticationIdentity[]> => [],
    findAuthenticationIdentitiesById: async (): Promise<AuthenticationIdentity[]> => [],
  },
  projects: {
    findProjectById: async (): Promise<PilotProjectRecord | null> => null,
  },
  projectHealth: {
    findCurrentProjectHealth: async (): Promise<PilotProjectHealthRecord | null> => null,
  },
  membership: {
    listMembershipsForProject: async (): Promise<ProjectMembership[]> => [],
    listRoleAssignmentsForProject: async (): Promise<ProjectRoleAssignment[]> => [],
    listProtectedRoleTransfers: async (): Promise<ProjectRoleTransferRecord[]> => [],
  },
} as ControlledPilotObservationSources;

function configuration(
  firstAccountPassword: string | undefined,
): ControlledPilotRuntimeConfiguration {
  return {
    runtimeTarget: {
      cadenceEnv: "local",
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseProjectRef: null,
      projectId,
      safeTargetMarker: "VS004_TEST_TARGET",
    },
    supabaseSecretKey: secret,
    firstAccountPassword,
  };
}

function executionServices(
  receivedPasswords: Array<string | undefined> = [],
): ControlledPilotExecutionServices {
  return {
    identity: {
      preparePilotIdentity: async (
        _intent,
        context,
      ) => {
        receivedPasswords.push(context.password);
        return {
          resources: [],
          evidence: {
            manifestUserKey: "test-user",
            personId: "00741000-0000-4000-8000-000000000002",
            cadenceUserId: "00742000-0000-4000-8000-000000000001",
            provider: "entra",
            providerSubjectId: "provider-subject",
            operatorPersonId: context.operatorPersonId,
            runCorrelationId: context.runCorrelationId,
          },
        };
      },
    },
    projects: {
      preparePilotProject: async () => ({ resources: [], evidence: {} as never }),
    },
    projectHealth: {
      preparePilotHealth: async () => ({ resources: [], evidence: {} as never }),
    },
    membership: {
      prepareMembership: async () => ({
        resourceKey: "membership:test",
        actualResult: "REUSED",
        resourceId: "00742000-0000-4000-8000-000000000001",
        evidence: {} as never,
      }),
      prepareOrdinaryRoleAssignment: async () => ({
        resourceKey: "role:test",
        actualResult: "REUSED",
        resourceId: "00744000-0000-4000-8000-000000000001",
        evidence: {} as never,
      }),
      prepareProtectedRoleAppointment: async () => ({
        resourceKey: "protected:test",
        actualResult: "REUSED",
        resourceId: "00744000-0000-4000-8000-000000000001",
        evidence: {} as never,
      }),
    },
  };
}

function factories(
  events: string[],
  services: ControlledPilotExecutionServices = executionServices(),
  overrides: Partial<ControlledPilotRuntimeFactories> = {},
): ControlledPilotRuntimeFactories {
  return {
    createSupabaseClient: (receivedConfiguration) => {
      assert.equal(receivedConfiguration.runtimeTarget.projectId, projectId);
      assert.equal(receivedConfiguration.supabaseSecretKey, secret);
      events.push("client");
      return client;
    },
    createAdministrativeAuthProvider: (receivedClient) => {
      assert.equal(receivedClient, client);
      events.push("auth");
      return authProvider;
    },
    createObservationSources: ({ client: receivedClient, authProvider: receivedProvider }) => {
      assert.equal(receivedClient, client);
      assert.equal(receivedProvider, authProvider);
      events.push("observation");
      return observationSources;
    },
    createExecutionServices: ({ client: receivedClient, authProvider: receivedProvider, configuration: receivedConfiguration }) => {
      assert.equal(receivedClient, client);
      assert.equal(receivedProvider, authProvider);
      assert.equal(receivedConfiguration.runtimeTarget.projectId, projectId);
      events.push("execution");
      return services;
    },
    ...overrides,
  };
}

function reachableOwnDataProperties(root: unknown): Array<{
  path: string;
  value: unknown;
}> {
  const seen = new Set<object>();
  const reachable: Array<{ path: string; value: unknown }> = [];

  function visit(value: unknown, path: string): void {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);

    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        continue;
      }
      const childPath = `${path}.${key}`;
      reachable.push({ path: childPath, value: descriptor.value });
      visit(descriptor.value, childPath);
    }
  }

  visit(root, "runtime");
  return reachable;
}


test("observation runtime constructs only client, Auth, and observation sources", () => {
  const events: string[] = [];
  const runtimeFactories = factories(events, executionServices(), {
    createExecutionServices: () => {
      throw new Error("execution services must not be constructed during observation");
    },
  });

  const result = buildControlledPilotObservationRuntime(
    configuration(password),
    runtimeFactories,
  );

  assert.deepEqual(events, ["client", "auth", "observation"]);
  assert.equal(result, observationSources);
});


test("observation runtime exposes read-only module surfaces without private infrastructure", () => {
  const result = buildControlledPilotObservationRuntime(
    configuration(password),
    factories([]),
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "auth",
    "identity",
    "membership",
    "projectHealth",
    "projects",
  ]);
  assert.equal("createAccount" in result.auth, false);
  assert.equal("createPerson" in result.identity, false);
  assert.equal("createProject" in result.projects, false);
  assert.equal("createCurrentProjectHealth" in result.projectHealth, false);
  assert.equal("createMembership" in result.membership, false);
  assert.equal("client" in result, false);
  assert.equal("repository" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|password/i);
});


test("execution runtime calls client, Auth, and execution factories without observation construction", () => {
  const events: string[] = [];
  const runtimeFactories = factories(events, executionServices(), {
    createObservationSources: () => {
      throw new Error("observation sources must not be constructed during execution");
    },
  });

  const result = buildControlledPilotExecutionServices(
    configuration(password),
    runtimeFactories,
  );

  assert.deepEqual(events, ["client", "auth", "execution"]);
  assert.deepEqual(Object.keys(result).sort(), [
    "identity",
    "membership",
    "projectHealth",
    "projects",
  ]);
  assert.equal("client" in result, false);
  assert.equal("authProvider" in result, false);
  assert.equal("repository" in result, false);
  assert.equal("configuration" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|password/i);
});


test("real default execution runtime does not expose concrete infrastructure through its object graph", () => {
  const runtime = buildControlledPilotExecutionServices({
    ...configuration(password),
    supabaseSecretKey: "VS004_SENTINEL_SECRET_MUST_NOT_BE_REACHABLE",
    firstAccountPassword: "VS004_SENTINEL_PASSWORD_MUST_NOT_BE_REACHABLE",
  });
  const reachable = reachableOwnDataProperties(runtime);
  const exposed = reachable.filter(({ path, value }) =>
    /repository|client|authProvider|configuration|supabaseKey|supabaseSecretKey|firstAccountPassword/i.test(path) ||
    value === "VS004_SENTINEL_SECRET_MUST_NOT_BE_REACHABLE" ||
    value === "VS004_SENTINEL_PASSWORD_MUST_NOT_BE_REACHABLE",
  );

  assert.deepEqual(exposed, [], exposed.map(({ path }) => path).join(", "));
});


test("execution facades expose exactly the committed method surfaces", () => {
  const runtime = buildControlledPilotExecutionServices(
    configuration(password),
    factories([]),
  );

  assert.deepEqual(Object.keys(runtime.identity), ["preparePilotIdentity"]);
  assert.deepEqual(Object.keys(runtime.projects), ["preparePilotProject"]);
  assert.deepEqual(Object.keys(runtime.projectHealth), ["preparePilotHealth"]);
  assert.deepEqual(Object.keys(runtime.membership).sort(), [
    "prepareMembership",
    "prepareOrdinaryRoleAssignment",
    "prepareProtectedRoleAppointment",
  ]);
});


test("execution facades delegate all committed preparation methods unchanged", async () => {
  const calls: string[] = [];
  const expected = {
    identity: { resources: [], evidence: {} },
    project: { resources: [], evidence: {} },
    health: { resources: [], evidence: {} },
    membership: { resourceKey: "membership", actualResult: "REUSED", resourceId: "membership", evidence: {} },
    ordinary: { resourceKey: "ordinary", actualResult: "REUSED", resourceId: "ordinary", evidence: {} },
    protected: { resourceKey: "protected", actualResult: "REUSED", resourceId: "protected", evidence: {} },
  };
  const services = {
    identity: {
      preparePilotIdentity: async (...args: unknown[]) => {
        calls.push(`identity:${args.length}`);
        return expected.identity;
      },
    },
    projects: {
      preparePilotProject: async (...args: unknown[]) => {
        calls.push(`project:${args.length}`);
        return expected.project;
      },
    },
    projectHealth: {
      preparePilotHealth: async (...args: unknown[]) => {
        calls.push(`health:${args.length}`);
        return expected.health;
      },
    },
    membership: {
      prepareMembership: async (...args: unknown[]) => {
        calls.push(`membership:${args.length}`);
        return expected.membership;
      },
      prepareOrdinaryRoleAssignment: async (...args: unknown[]) => {
        calls.push(`ordinary:${args.length}`);
        return expected.ordinary;
      },
      prepareProtectedRoleAppointment: async (...args: unknown[]) => {
        calls.push(`protected:${args.length}`);
        return expected.protected;
      },
    },
  } as unknown as ControlledPilotExecutionServices;
  const runtime = buildControlledPilotExecutionServices(
    configuration(password),
    factories([], services),
  );

  assert.equal(
    await runtime.identity.preparePilotIdentity({} as never, {} as never),
    expected.identity,
  );
  assert.equal(
    await runtime.projects.preparePilotProject({} as never, {} as never, "REUSE"),
    expected.project,
  );
  assert.equal(
    await runtime.projectHealth.preparePilotHealth({} as never, {} as never, "REUSE"),
    expected.health,
  );
  assert.equal(
    await runtime.membership.prepareMembership({} as never),
    expected.membership,
  );
  assert.equal(
    await runtime.membership.prepareOrdinaryRoleAssignment({} as never),
    expected.ordinary,
  );
  assert.equal(
    await runtime.membership.prepareProtectedRoleAppointment({} as never),
    expected.protected,
  );
  assert.deepEqual(calls, [
    "identity:3",
    "project:3",
    "health:3",
    "membership:1",
    "ordinary:1",
    "protected:1",
  ]);
});


test("execution Identity facade binds the configured password only at service invocation", async () => {
  const receivedPasswords: Array<string | undefined> = [];
  const result = buildControlledPilotExecutionServices(
    configuration(password),
    factories([], executionServices(receivedPasswords)),
  );

  await result.identity.preparePilotIdentity(
    {} as PilotIdentityPreparationIntent,
    { operatorPersonId, runCorrelationId: "00748000-0000-4000-8000-000000000001" },
  );

  assert.deepEqual(receivedPasswords, [password]);
  assert.doesNotMatch(JSON.stringify(result), /password-that-must-not-leak/);
});


test("execution Identity facade passes undefined when no first-account password is configured", async () => {
  const receivedPasswords: Array<string | undefined> = [];
  const result = buildControlledPilotExecutionServices(
    configuration(undefined),
    factories([], executionServices(receivedPasswords)),
  );

  await result.identity.preparePilotIdentity(
    {} as PilotIdentityPreparationIntent,
    { operatorPersonId, runCorrelationId: "00748000-0000-4000-8000-000000000002" },
  );

  assert.deepEqual(receivedPasswords, [undefined]);
});


test("Projects and Project Health remain separate handler-facing boundaries", () => {
  const result = buildControlledPilotObservationRuntime(
    configuration(password),
    factories([]),
  );

  assert.notEqual(result.projects, result.projectHealth);
  assert.equal("findCurrentProjectHealth" in result.projects, false);
  assert.equal("findProjectById" in result.projectHealth, false);
});
