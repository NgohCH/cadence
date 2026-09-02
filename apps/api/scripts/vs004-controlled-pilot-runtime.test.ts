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
