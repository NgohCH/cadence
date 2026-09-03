import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthProvider,
} from "../../infrastructure/auth/administrative-auth-provider";
import type {
  IdentityPilotPreparationRepository,
} from "./pilot-preparation.repository";
import type {
  AuthenticationIdentity,
  CadencePerson,
} from "./identity.types";
import {
  PilotPreparationError,
  PilotPreparationService,
  type PilotIdentityPreparationContext,
  type PilotIdentityPreparationIntent,
  type PilotCadenceUserRecord,
} from "./pilot-preparation.service";


const operatorPersonId =
  "00441000-0000-4000-8000-000000000001";
const personId =
  "00441000-0000-4000-8000-000000000002";
const cadenceUserId =
  "00448000-0000-4000-8000-000000000002";
const authSubject =
  "00446000-0000-4000-8000-000000000002";
const identityId =
  "00445000-0000-4000-8000-000000000002";
const validFrom =
  "2026-09-01T00:00:00.000Z";


class FakeIdentityRepository
  implements IdentityPilotPreparationRepository
{
  readonly persons: CadencePerson[] = [
    {
      id: operatorPersonId,
      displayName: "Pilot Operator",
    },
  ];

  readonly cadenceUsers: PilotCadenceUserRecord[] = [];
  readonly authenticationIdentities: AuthenticationIdentity[] = [];
  readonly calls: string[] = [];
  failure: "createPerson" | "createCadenceUser" | "createAuthenticationIdentity" | null = null;

  async findPersonById(id: string): Promise<CadencePerson | null> {
    this.calls.push(`findPerson:${id}`);
    return this.persons.find((person) => person.id === id) ?? null;
  }

  async createPerson(person: CadencePerson): Promise<CadencePerson> {
    this.calls.push("createPerson");
    if (this.failure === "createPerson") {
      throw new Error("persistence failure");
    }
    this.persons.push(person);
    return person;
  }

  async findCadenceUserById(id: string): Promise<PilotCadenceUserRecord | null> {
    this.calls.push(`findCadenceUser:${id}`);
    return this.cadenceUsers.find((user) => user.id === id) ?? null;
  }

  async createCadenceUser(user: PilotCadenceUserRecord): Promise<PilotCadenceUserRecord> {
    this.calls.push("createCadenceUser");
    if (this.failure === "createCadenceUser") {
      throw new Error("persistence failure");
    }
    this.cadenceUsers.push(user);
    return user;
  }

  async listAuthenticationIdentities(personIdValue: string): Promise<AuthenticationIdentity[]> {
    this.calls.push(`listIdentities:${personIdValue}`);
    return this.authenticationIdentities.filter(
      (identity) => identity.personId === personIdValue,
    );
  }

  async findAuthenticationIdentitiesByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<AuthenticationIdentity[]> {
    this.calls.push(`findIdentitySubject:${provider}:${providerSubjectId}`);
    return this.authenticationIdentities.filter(
      (identity) =>
        identity.provider === provider &&
        identity.providerSubjectId === providerSubjectId,
    );
  }

  async findAuthenticationIdentitiesById(
    identityIdValue: string,
  ): Promise<AuthenticationIdentity[]> {
    this.calls.push(`findIdentityId:${identityIdValue}`);
    return this.authenticationIdentities.filter(
      (identity) => identity.id === identityIdValue,
    );
  }

  async createAuthenticationIdentity(
    identity: AuthenticationIdentity,
  ): Promise<AuthenticationIdentity> {
    this.calls.push("createAuthenticationIdentity");
    if (this.failure === "createAuthenticationIdentity") {
      throw new Error("persistence failure");
    }
    this.authenticationIdentities.push(identity);
    return identity;
  }
}


class FakeAdministrativeAuthProvider
  implements AdministrativeAuthProvider
{
  readonly accounts: AdministrativeAuthAccount[] = [];
  readonly calls: string[] = [];
  createFailure = false;
  findFailure = false;
  receivedCredential: string | undefined;

  async findAccounts(input: {
    provider: string;
    loginIdentifier: string;
    providerSubjectId?: string;
  }): Promise<readonly AdministrativeAuthAccount[]> {
    this.calls.push("findAccounts");
    if (this.findFailure) {
      throw new Error("provider lookup failure containing secret");
    }
    return this.accounts.filter(
      (account) =>
        account.provider === input.provider &&
        (account.loginIdentifier.toLowerCase() === input.loginIdentifier.toLowerCase() ||
          (input.providerSubjectId !== undefined &&
            account.providerSubjectId === input.providerSubjectId)),
    );
  }

  async createAccount(
    input: {
      provider: string;
      loginIdentifier: string;
      providerSubjectId?: string;
      manifestUserKey: string;
    },
    credentials: { readonly password?: string },
  ): Promise<AdministrativeAuthAccount> {
    this.calls.push("createAccount");
    this.receivedCredential = credentials.password;
    if (this.createFailure) {
      throw new Error("provider failure containing secret");
    }
    const account = {
      provider: input.provider,
      providerSubjectId: input.providerSubjectId ?? authSubject,
      loginIdentifier: input.loginIdentifier,
      status: "active" as const,
    };
    this.accounts.push(account);
    return account;
  }
}


function intent(
  overrides: Partial<PilotIdentityPreparationIntent> = {},
): PilotIdentityPreparationIntent {
  return {
    manifestUserKey: "owner",
    person: {
      kind: "new",
      id: personId,
      displayName: "Pilot Owner",
    },
    cadenceUser: {
      id: cadenceUserId,
      username: "pilot_owner",
      displayName: "Pilot Owner",
      email: "owner@cadence.test",
      status: "active",
      identityProvider: "local",
    },
    authentication: {
      identityId,
      provider: "local",
      providerSubjectId: authSubject,
      loginIdentifier: "owner@cadence.test",
      validFrom,
      validTo: null,
    },
    ...overrides,
  };
}


function context(
  overrides: Partial<PilotIdentityPreparationContext> = {},
): PilotIdentityPreparationContext {
  return {
    operatorPersonId,
    runCorrelationId: "00449000-0000-4000-8000-000000000001",
    password: "protected-runtime-only-password",
    ...overrides,
  };
}


function exactState(
  repository: FakeIdentityRepository,
  provider: FakeAdministrativeAuthProvider,
): void {
  repository.persons.push({
    id: personId,
    displayName: "Pilot Owner",
  });
  provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });
  repository.cadenceUsers.push({
    id: cadenceUserId,
    authUserId: authSubject,
    personId,
    username: "pilot_owner",
    displayName: "Pilot Owner",
    email: "owner@cadence.test",
    status: "active",
    identityProvider: "local",
  });
  repository.authenticationIdentities.push({
    id: identityId,
    personId,
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    validFrom,
    validTo: null,
    status: "ACTIVE",
  });
}


function service(): {
  repository: FakeIdentityRepository;
  provider: FakeAdministrativeAuthProvider;
  service: PilotPreparationService;
} {
  const repository = new FakeIdentityRepository();
  const provider = new FakeAdministrativeAuthProvider();
  return {
    repository,
    provider,
    service: new PilotPreparationService(repository, provider),
  };
}


test("creates missing Person, Auth account, Cadence User, and authentication identity", async () => {
  const setup = service();
  const result = await setup.service.preparePilotIdentity(
    intent(),
    context(),
  );

  assert.deepEqual(
    result.resources.map((resource) => resource.status),
    ["CREATED", "CREATED", "CREATED", "CREATED"],
  );
  assert.equal(result.evidence.personId, personId);
  assert.equal(result.evidence.cadenceUserId, cadenceUserId);
  assert.equal(result.evidence.providerSubjectId, authSubject);
});


test("planned Identity REUSE fails stale when a required resource is absent without creating", async () => {
  const setup = service();

  await assert.rejects(
    setup.service.preparePilotIdentity(intent(), context(), {
      PERSON: "REUSE",
      CADENCE_USER: "REUSE",
      AUTHENTICATION_IDENTITY: "REUSE",
    }),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.code === "STALE_PLAN",
  );
  assert.equal(
    setup.repository.calls.some((call) => call.startsWith("create")),
    false,
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("Identity validates all REUSE resources before creating another planned resource", async () => {
  const setup = service();

  await assert.rejects(
    setup.service.preparePilotIdentity(intent(), context(), {
      PERSON: "REUSE",
      CADENCE_USER: "CREATE",
      AUTHENTICATION_IDENTITY: "CREATE",
    }),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.code === "STALE_PLAN",
  );
  assert.equal(setup.repository.calls.some((call) => call.startsWith("create")), false);
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("Auth-account REUSE cannot inherit CREATE from authentication identity", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });

  await assert.rejects(
    setup.service.preparePilotIdentity(intent(), context(), {
      AUTH_ACCOUNT: "REUSE",
      PERSON: "REUSE",
      CADENCE_USER: "CREATE",
      AUTHENTICATION_IDENTITY: "CREATE",
    }),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.code === "STALE_PLAN",
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
  assert.equal(setup.repository.calls.some((call) => call.startsWith("create")), false);
});


test("mixed Auth-account and authentication-identity actions remain independent", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });

  const result = await setup.service.preparePilotIdentity(intent(), context(), {
    AUTH_ACCOUNT: "REUSE",
    PERSON: "REUSE",
    CADENCE_USER: "CREATE",
    AUTHENTICATION_IDENTITY: "CREATE",
  });

  assert.deepEqual(
    result.resources.map((resource) => [resource.resource, resource.status]),
    [
      ["AUTH_ACCOUNT", "REUSED"],
      ["PERSON", "REUSED"],
      ["CADENCE_USER", "CREATED"],
      ["AUTHENTICATION_IDENTITY", "CREATED"],
    ],
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("reuses exact Person without rewriting it", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });

  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.equal(result.resources.find((resource) => resource.resource === "PERSON")?.status, "REUSED");
  assert.equal(setup.repository.calls.includes("createPerson"), false);
});


test("rejects contradictory Person identity", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Different Person" });

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "PERSON" &&
      error.code === "CONFLICT",
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("creates missing Cadence User after exact Person and Auth account are present", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });

  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.equal(result.resources.find((resource) => resource.resource === "CADENCE_USER")?.status, "CREATED");
  assert.equal(setup.repository.cadenceUsers[0].authUserId, authSubject);
});


test("reuses exact Cadence User", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);

  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.equal(result.resources.find((resource) => resource.resource === "CADENCE_USER")?.status, "REUSED");
  assert.equal(setup.repository.calls.includes("createCadenceUser"), false);
});


test("rejects Cadence User mapped to the wrong Person", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);
  setup.repository.cadenceUsers[0].personId = operatorPersonId;

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    /Cadence User.*Person|CADENCE_USER/i,
  );
});


test("rejects Cadence User mapped to the wrong Auth subject", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);
  setup.repository.cadenceUsers[0].authUserId = "00446000-0000-4000-8000-000000000099";

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    /Cadence User.*Auth|CADENCE_USER/i,
  );
});


test("creates and then reuses the canonical authentication identity", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });

  const created = await setup.service.preparePilotIdentity(intent(), context());
  assert.equal(created.resources.find((resource) => resource.resource === "AUTHENTICATION_IDENTITY")?.status, "CREATED");

  const rerun = await setup.service.preparePilotIdentity(intent(), context({
    runCorrelationId: "00449000-0000-4000-8000-000000000002",
  }));
  assert.equal(rerun.resources.find((resource) => resource.resource === "AUTHENTICATION_IDENTITY")?.status, "REUSED");
  assert.equal(
    setup.repository.calls.filter((call) => call === "createAuthenticationIdentity").length,
    1,
  );
});


test("rejects provider subject mapped to another Person", async () => {
  const setup = service();
  setup.repository.authenticationIdentities.push({
    id: "00445000-0000-4000-8000-000000000099",
    personId: operatorPersonId,
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "operator@cadence.test",
    validFrom,
    validTo: null,
    status: "ACTIVE",
  });

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    /provider subject.*Person|AUTHENTICATION_IDENTITY/i,
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("rejects an explicit authentication-identity ID owned by another Person before mutation", async () => {
  const setup = service();
  setup.repository.authenticationIdentities.push({
    id: identityId,
    personId: operatorPersonId,
    provider: "local",
    providerSubjectId: "00446000-0000-4000-8000-000000000099",
    loginIdentifier: "operator@cadence.test",
    validFrom,
    validTo: null,
    status: "ACTIVE",
  });

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "AUTHENTICATION_IDENTITY" &&
      error.code === "CONFLICT",
  );
  assert.equal(setup.provider.calls.includes("createAccount"), false);
  assert.equal(setup.repository.calls.includes("createPerson"), false);
});


test("checks the provider subject returned by an existing account when intent omits it", async () => {
  const setup = service();
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });
  setup.repository.authenticationIdentities.push({
    id: "00445000-0000-4000-8000-000000000099",
    personId: operatorPersonId,
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "operator@cadence.test",
    validFrom,
    validTo: null,
    status: "ACTIVE",
  });
  const base = intent();
  const omittedSubject = {
    ...base,
    authentication: {
      ...base.authentication,
      providerSubjectId: undefined,
    },
  };

  await assert.rejects(
    () => setup.service.preparePilotIdentity(omittedSubject, context()),
    /provider subject.*Person|AUTHENTICATION_IDENTITY/i,
  );
  assert.equal(setup.repository.calls.includes("createPerson"), false);
});


test("rejects multiple conflicting active identities", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.repository.authenticationIdentities.push(
    {
      id: identityId,
      personId,
      provider: "local",
      providerSubjectId: authSubject,
      loginIdentifier: "owner@cadence.test",
      validFrom,
      validTo: null,
      status: "ACTIVE",
    },
    {
      id: "00445000-0000-4000-8000-000000000099",
      personId,
      provider: "local",
      providerSubjectId: "00446000-0000-4000-8000-000000000099",
      loginIdentifier: "other@cadence.test",
      validFrom,
      validTo: null,
      status: "ACTIVE",
    },
  );

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    /multiple.*active.*identit|AUTHENTICATION_IDENTITY/i,
  );
});


test("does not reactivate or rewrite ended identity history", async () => {
  const setup = service();
  setup.repository.authenticationIdentities.push({
    id: identityId,
    personId,
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    validFrom,
    validTo: "2026-08-31T00:00:00.000Z",
    status: "DISABLED",
  });

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    /historical|ended|identity/i,
  );
  assert.equal(setup.repository.calls.includes("createAuthenticationIdentity"), false);
});


test("preserves an ended historical identity while creating a new replacement mapping", async () => {
  const setup = service();
  const replacementSubject = "00446000-0000-4000-8000-000000000003";
  const replacementIdentityId = "00445000-0000-4000-8000-000000000003";
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: replacementSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });
  const historical: AuthenticationIdentity = {
    id: identityId,
    personId,
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "old-owner@cadence.test",
    validFrom,
    validTo: "2026-08-31T00:00:00.000Z",
    status: "DISABLED",
  };
  setup.repository.authenticationIdentities.push(historical);
  const base = intent();
  const replacementIntent = {
    ...base,
    authentication: {
      ...base.authentication,
      identityId: replacementIdentityId,
      providerSubjectId: replacementSubject,
    },
  };

  const result = await setup.service.preparePilotIdentity(replacementIntent, context());

  assert.equal(result.evidence.providerSubjectId, replacementSubject);
  assert.deepEqual(setup.repository.authenticationIdentities[0], historical);
  assert.equal(setup.repository.authenticationIdentities.length, 2);
});


test("resumes an exact compatible partial state by creating only missing resources", async () => {
  const setup = service();
  setup.repository.persons.push({ id: personId, displayName: "Pilot Owner" });
  setup.provider.accounts.push({
    provider: "local",
    providerSubjectId: authSubject,
    loginIdentifier: "owner@cadence.test",
    status: "active",
  });

  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.equal(result.resources.find((resource) => resource.resource === "PERSON")?.status, "REUSED");
  assert.equal(result.resources.find((resource) => resource.resource === "AUTH_ACCOUNT")?.status, "REUSED");
  assert.equal(setup.repository.calls.includes("createPerson"), false);
  assert.equal(setup.provider.calls.includes("createAccount"), false);
});


test("exact full state performs zero writes", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);

  const beforeRepositoryCalls = setup.repository.calls.length;
  const beforeProviderCalls = setup.provider.calls.length;
  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.ok(result.resources.every((resource) => resource.status === "REUSED"));
  assert.equal(
    setup.repository.calls.slice(beforeRepositoryCalls).some((call) => call.startsWith("create")),
    false,
  );
  assert.equal(
    setup.provider.calls.slice(beforeProviderCalls).includes("createAccount"),
    false,
  );
});


test("failure stops later steps without destructive compensation", async () => {
  const setup = service();
  setup.repository.failure = "createPerson";

  await assert.rejects(
    () => setup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "PERSON" &&
      error.code === "PERSISTENCE_FAILED" &&
      error.evidence?.manifestUserKey === "owner" &&
      error.evidence.runCorrelationId === "00449000-0000-4000-8000-000000000001",
  );
  assert.equal(setup.provider.calls.includes("createAccount"), true);
  assert.equal(setup.repository.calls.includes("createCadenceUser"), false);
  assert.equal(setup.repository.calls.includes("createAuthenticationIdentity"), false);
  assert.equal(setup.provider.calls.some((call) => /delete|update|reset/i.test(call)), false);
});


test("rerun never resets a password and evidence contains no credentials", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);

  const result = await setup.service.preparePilotIdentity(intent(), context());
  const evidence = JSON.stringify(result);

  assert.equal(setup.provider.calls.includes("resetPassword"), false);
  assert.doesNotMatch(evidence, /protected-runtime-only-password/);
  assert.doesNotMatch(evidence, /secret|token|bearer/i);
});


test("retains operator and run correlation provenance", async () => {
  const setup = service();
  exactState(setup.repository, setup.provider);

  const result = await setup.service.preparePilotIdentity(intent(), context());

  assert.equal(result.evidence.operatorPersonId, operatorPersonId);
  assert.equal(result.evidence.runCorrelationId, "00449000-0000-4000-8000-000000000001");
  assert.equal(result.evidence.manifestUserKey, "owner");
});


test("surfaces provider and repository failures as categorized safe errors", async () => {
  const lookupSetup = service();
  lookupSetup.provider.findFailure = true;
  await assert.rejects(
    () => lookupSetup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "PROVIDER" &&
      error.code === "PROVIDER_FAILED" &&
      !error.message.includes("secret"),
  );

  const providerSetup = service();
  providerSetup.provider.createFailure = true;
  await assert.rejects(
    () => providerSetup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "PROVIDER" &&
      !error.message.includes("secret"),
  );

  const repositorySetup = service();
  repositorySetup.repository.failure = "createAuthenticationIdentity";
  await assert.rejects(
    () => repositorySetup.service.preparePilotIdentity(intent(), context()),
    (error: unknown) =>
      error instanceof PilotPreparationError &&
      error.category === "AUTHENTICATION_IDENTITY",
  );
});
