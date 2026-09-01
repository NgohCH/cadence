import { randomUUID } from "node:crypto";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthProvider,
} from "../../infrastructure/auth/administrative-auth-provider";
import type {
  AuthenticationIdentity,
  CadencePerson,
} from "./identity.types";
import type {
  IdentityPilotPreparationRepository,
} from "./pilot-preparation.repository";
import type {
  PilotCadenceUserRecord,
  PilotIdentityPreparationContext,
  PilotIdentityPreparationIntent,
  PilotIdentityPreparationResult,
  PilotPreparationErrorCategory,
  PilotPreparationFailureEvidence,
  PilotPreparationResourceEvidence,
} from "./pilot-preparation.types";


export {
  type PilotCadenceUserRecord,
  type PilotIdentityPreparationContext,
  type PilotIdentityPreparationIntent,
  type PilotIdentityPreparationResult,
} from "./pilot-preparation.types";


export class PilotPreparationError extends Error {
  readonly category: PilotPreparationErrorCategory;
  readonly code:
    | "INVALID_INPUT"
    | "MISSING"
    | "CONFLICT"
    | "PROVIDER_FAILED"
    | "PERSISTENCE_FAILED"
    | "POSTCONDITION_FAILED";
  evidence?: PilotPreparationFailureEvidence;

  constructor(
    category: PilotPreparationErrorCategory,
    code: PilotPreparationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PilotPreparationError";
    this.category = category;
    this.code = code;
  }
}


export class PilotPreparationService {
  constructor(
    private readonly repository: IdentityPilotPreparationRepository,
    private readonly authProvider: AdministrativeAuthProvider,
  ) {}

  async preparePilotIdentity(
    intent: PilotIdentityPreparationIntent,
    context: PilotIdentityPreparationContext,
  ): Promise<PilotIdentityPreparationResult> {
    validateInput(intent, context);

    try {
      const observed = await this.readObservedState(intent, context);
      const account = validateObservedState(intent, context, observed);
      const resources: PilotPreparationResourceEvidence[] = [];

      const preparedAccount = await this.ensureAuthAccount(
        intent,
        context,
        account,
        resources,
      );
      const person = await this.ensurePerson(
        intent,
        observed.person,
        resources,
      );
      const cadenceUser = await this.ensureCadenceUser(
        intent,
        preparedAccount.providerSubjectId,
        person.id,
        observed.cadenceUser,
        resources,
      );
      const identity = await this.ensureAuthenticationIdentity(
        intent,
        preparedAccount.providerSubjectId,
        person.id,
        observed.authenticationIdentities,
        resources,
      );

      return deepFreeze({
        resources,
        evidence: {
          manifestUserKey: intent.manifestUserKey,
          personId: person.id,
          cadenceUserId: cadenceUser.id,
          provider: intent.authentication.provider,
          providerSubjectId: identity.providerSubjectId,
          operatorPersonId: context.operatorPersonId,
          runCorrelationId: context.runCorrelationId,
        },
      });
    } catch (error) {
      if (error instanceof PilotPreparationError) {
        error.evidence = {
          manifestUserKey: intent.manifestUserKey,
          operatorPersonId: context.operatorPersonId,
          runCorrelationId: context.runCorrelationId,
        };
        throw error;
      }
      throw preparationError(
        "INPUT",
        "PERSISTENCE_FAILED",
        "Identity preparation failed.",
      );
    }
  }

  private async readObservedState(
    intent: PilotIdentityPreparationIntent,
    context: PilotIdentityPreparationContext,
  ): Promise<ObservedState> {
    try {
      const operator = await this.repository.findPersonById(
        context.operatorPersonId,
      );
      const person = await this.repository.findPersonById(intent.person.id);
      const cadenceUser = await this.repository.findCadenceUserById(
        intent.cadenceUser.id,
      );
      const authenticationIdentities =
        await this.repository.listAuthenticationIdentities(intent.person.id);
      const identityIdIdentities = intent.authentication.identityId
        ? await this.repository.findAuthenticationIdentitiesById(
            intent.authentication.identityId,
          )
        : [];
      const lookupSubject =
        intent.authentication.providerSubjectId ??
        cadenceUser?.authUserId;
      let subjectIdentities = lookupSubject
        ? await this.repository.findAuthenticationIdentitiesByProviderSubject(
            intent.authentication.provider,
            lookupSubject,
          )
        : [];
      let accounts: readonly AdministrativeAuthAccount[];
      try {
        accounts = await this.authProvider.findAccounts({
          provider: intent.authentication.provider,
          loginIdentifier: intent.authentication.loginIdentifier,
          ...(lookupSubject ? { providerSubjectId: lookupSubject } : {}),
        });
      } catch {
        throw preparationError(
          "PROVIDER",
          "PROVIDER_FAILED",
          "Administrative Auth account lookup failed.",
        );
      }
      const returnedSubject = accounts.length === 1
        ? accounts[0].providerSubjectId
        : undefined;
      if (returnedSubject && returnedSubject !== lookupSubject) {
        subjectIdentities =
          await this.repository.findAuthenticationIdentitiesByProviderSubject(
            intent.authentication.provider,
            returnedSubject,
          );
      }
      return {
        operator,
        person,
        cadenceUser,
        authenticationIdentities,
        identityIdIdentities,
        subjectIdentities,
        accounts,
      };
    } catch (error) {
      if (error instanceof PilotPreparationError) {
        throw error;
      }
      throw preparationError(
        "INPUT",
        "PERSISTENCE_FAILED",
        "Unable to read the Identity preparation state.",
      );
    }
  }

  private async ensureAuthAccount(
    intent: PilotIdentityPreparationIntent,
    context: PilotIdentityPreparationContext,
    existing: AdministrativeAuthAccount | null,
    resources: PilotPreparationResourceEvidence[],
  ): Promise<AdministrativeAuthAccount> {
    if (existing) {
      resources.push({
        resource: "AUTH_ACCOUNT",
        status: "REUSED",
        id: existing.providerSubjectId,
      });
      return existing;
    }

    let created: AdministrativeAuthAccount;
    try {
      created = await this.authProvider.createAccount(
        {
          provider: intent.authentication.provider,
          loginIdentifier: intent.authentication.loginIdentifier,
          ...(intent.authentication.providerSubjectId
            ? { providerSubjectId: intent.authentication.providerSubjectId }
            : {}),
          manifestUserKey: intent.manifestUserKey,
        },
        { password: context.password },
      );
    } catch {
      throw preparationError(
        "PROVIDER",
        "PROVIDER_FAILED",
        "Administrative Auth account preparation failed.",
      );
    }
    if (
      created.provider !== intent.authentication.provider ||
      created.loginIdentifier.toLowerCase() !==
        intent.authentication.loginIdentifier.toLowerCase() ||
      created.status !== "active" ||
      (intent.authentication.providerSubjectId !== undefined &&
        created.providerSubjectId !== intent.authentication.providerSubjectId)
    ) {
      throw preparationError(
        "PROVIDER",
        "POSTCONDITION_FAILED",
        "Administrative Auth account postcondition was incompatible.",
      );
    }
    resources.push({
      resource: "AUTH_ACCOUNT",
      status: "CREATED",
      id: created.providerSubjectId,
    });
    return created;
  }

  private async ensurePerson(
    intent: PilotIdentityPreparationIntent,
    observed: CadencePerson | null,
    resources: PilotPreparationResourceEvidence[],
  ): Promise<CadencePerson> {
    if (observed) {
      resources.push({
        resource: "PERSON",
        status: "REUSED",
        id: observed.id,
      });
      return observed;
    }
    if (intent.person.kind !== "new") {
      throw preparationError(
        "PERSON",
        "MISSING",
        "Cadence Person is missing for the intended identity.",
      );
    }
    let created: CadencePerson;
    try {
      created = await this.repository.createPerson({
        id: intent.person.id,
        displayName: intent.person.displayName,
      });
      const verified = await this.repository.findPersonById(intent.person.id);
      if (
        !verified ||
        verified.id !== intent.person.id ||
        verified.displayName !== intent.person.displayName
      ) {
        throw new Error("postcondition");
      }
      created = verified;
    } catch {
      throw preparationError(
        "PERSON",
        "PERSISTENCE_FAILED",
        "Cadence Person preparation failed.",
      );
    }
    resources.push({
      resource: "PERSON",
      status: "CREATED",
      id: created.id,
    });
    return created;
  }

  private async ensureCadenceUser(
    intent: PilotIdentityPreparationIntent,
    authUserId: string,
    personId: string,
    existing: PilotCadenceUserRecord | null,
    resources: PilotPreparationResourceEvidence[],
  ): Promise<PilotCadenceUserRecord> {
    const expected = {
      id: intent.cadenceUser.id,
      authUserId,
      personId,
      username: intent.cadenceUser.username,
      displayName: intent.cadenceUser.displayName,
      email: intent.cadenceUser.email,
      status: "active" as const,
      identityProvider: intent.cadenceUser.identityProvider,
    } satisfies PilotCadenceUserRecord;
    if (existing) {
      if (!sameCadenceUser(existing, expected)) {
        throw preparationError(
          "CADENCE_USER",
          "CONFLICT",
          "Cadence User mapping conflicts with the intended Person or Auth subject.",
        );
      }
      resources.push({
        resource: "CADENCE_USER",
        status: "REUSED",
        id: existing.id,
      });
      return existing;
    }
    try {
      const created = await this.repository.createCadenceUser(expected);
      const verified = await this.repository.findCadenceUserById(expected.id);
      if (!verified || !sameCadenceUser(verified, expected)) {
        throw new Error("postcondition");
      }
      resources.push({
        resource: "CADENCE_USER",
        status: "CREATED",
        id: verified.id,
      });
      return verified;
    } catch (error) {
      if (error instanceof PilotPreparationError) {
        throw error;
      }
      throw preparationError(
        "CADENCE_USER",
        "PERSISTENCE_FAILED",
        "Cadence User preparation failed.",
      );
    }
  }

  private async ensureAuthenticationIdentity(
    intent: PilotIdentityPreparationIntent,
    providerSubjectId: string,
    personId: string,
    existing: readonly AuthenticationIdentity[],
    resources: PilotPreparationResourceEvidence[],
  ): Promise<AuthenticationIdentity> {
    const expected = {
      id: intent.authentication.identityId ?? randomUUID(),
      personId,
      provider: intent.authentication.provider,
      providerSubjectId,
      loginIdentifier: intent.authentication.loginIdentifier,
      validFrom: intent.authentication.validFrom,
      validTo: intent.authentication.validTo,
      status: "ACTIVE" as const,
    } satisfies AuthenticationIdentity;
    const exact = existing.find(
      (identity) =>
        (intent.authentication.identityId !== undefined &&
          identity.id === intent.authentication.identityId) ||
        (identity.provider === expected.provider &&
          identity.providerSubjectId === expected.providerSubjectId),
    );
    if (exact) {
      if (!sameAuthenticationIdentity(exact, expected)) {
        throw preparationError(
          "AUTHENTICATION_IDENTITY",
          "CONFLICT",
          "Authentication identity history conflicts with the intended mapping.",
        );
      }
      resources.push({
        resource: "AUTHENTICATION_IDENTITY",
        status: "REUSED",
        id: exact.id,
      });
      return exact;
    }
    try {
      const created = await this.repository.createAuthenticationIdentity(expected);
      const verified = (await this.repository.listAuthenticationIdentities(personId))
        .find((identity) => identity.id === expected.id);
      if (!verified || !sameAuthenticationIdentity(verified, expected)) {
        throw new Error("postcondition");
      }
      resources.push({
        resource: "AUTHENTICATION_IDENTITY",
        status: "CREATED",
        id: created.id,
      });
      return verified;
    } catch (error) {
      if (error instanceof PilotPreparationError) {
        throw error;
      }
      throw preparationError(
        "AUTHENTICATION_IDENTITY",
        "PERSISTENCE_FAILED",
        "Authentication identity preparation failed.",
      );
    }
  }

}


interface ObservedState {
  operator: CadencePerson | null;
  person: CadencePerson | null;
  cadenceUser: PilotCadenceUserRecord | null;
  authenticationIdentities: readonly AuthenticationIdentity[];
  identityIdIdentities: readonly AuthenticationIdentity[];
  subjectIdentities: readonly AuthenticationIdentity[];
  accounts: readonly AdministrativeAuthAccount[];
}


function validateInput(
  intent: PilotIdentityPreparationIntent,
  context: PilotIdentityPreparationContext,
): void {
  if (
    !intent.manifestUserKey.trim() ||
    !intent.person.id.trim() ||
    !intent.person.displayName.trim() ||
    !intent.cadenceUser.id.trim() ||
    !intent.authentication.provider.trim() ||
    !intent.authentication.loginIdentifier.trim() ||
    !context.operatorPersonId.trim() ||
    !context.runCorrelationId.trim()
  ) {
    throw preparationError("INPUT", "INVALID_INPUT", "Identity preparation input is incomplete.");
  }
}


function validateObservedState(
  intent: PilotIdentityPreparationIntent,
  context: PilotIdentityPreparationContext,
  observed: ObservedState,
): AdministrativeAuthAccount | null {
  if (!observed.operator) {
    throw preparationError("INPUT", "MISSING", "Authorising operator Person is missing.");
  }
  if (observed.person) {
    if (
      observed.person.id !== intent.person.id ||
      observed.person.displayName !== intent.person.displayName
    ) {
      throw preparationError("PERSON", "CONFLICT", "Cadence Person identity facts conflict.");
    }
  } else if (intent.person.kind !== "new") {
    throw preparationError("PERSON", "MISSING", "Existing Cadence Person is missing.");
  }

  const activeIdentities = observed.authenticationIdentities.filter(
    isActiveIdentity,
  );
  if (activeIdentities.length > 1) {
    throw preparationError(
      "AUTHENTICATION_IDENTITY",
      "CONFLICT",
      "Multiple conflicting active authentication identities exist.",
    );
  }
  const accounts = observed.accounts;
  if (accounts.length > 1) {
    throw preparationError(
      "PROVIDER",
      "CONFLICT",
      "Multiple conflicting Auth accounts match the intended identity.",
    );
  }
  const account = accounts[0] ?? null;
  if (account && account.status !== "active") {
    throw preparationError("PROVIDER", "CONFLICT", "Existing Auth account is disabled.");
  }
  if (
    account &&
    (account.provider !== intent.authentication.provider ||
      account.loginIdentifier.toLowerCase() !==
        intent.authentication.loginIdentifier.toLowerCase() ||
      (intent.authentication.providerSubjectId !== undefined &&
        account.providerSubjectId !== intent.authentication.providerSubjectId))
  ) {
    throw preparationError("PROVIDER", "CONFLICT", "Auth account facts conflict with the intended identity.");
  }
  const targetSubject =
    account?.providerSubjectId ?? intent.authentication.providerSubjectId;
  const relevantIdentities = uniqueIdentities([
    ...observed.subjectIdentities,
    ...observed.identityIdIdentities,
    ...observed.authenticationIdentities.filter(
      (identity) =>
        (intent.authentication.identityId !== undefined &&
          identity.id === intent.authentication.identityId) ||
        (targetSubject !== undefined &&
          identity.provider === intent.authentication.provider &&
          identity.providerSubjectId === targetSubject),
    ),
  ]);
  if (
    relevantIdentities.some(
      (identity) => identity.personId !== intent.person.id,
    )
  ) {
    throw preparationError(
      "AUTHENTICATION_IDENTITY",
      "CONFLICT",
      "Provider subject is mapped to another Person.",
    );
  }
  if (
    relevantIdentities.some(
      (identity) =>
        identity.status !== "ACTIVE" || identity.validTo !== null,
    )
  ) {
    throw preparationError(
      "AUTHENTICATION_IDENTITY",
      "CONFLICT",
      "Historical or ended authentication identity cannot be reactivated.",
    );
  }
  const actualSubject =
    targetSubject;
  if (
    observed.cadenceUser &&
    actualSubject !== undefined &&
    observed.cadenceUser.authUserId !== actualSubject
  ) {
    throw preparationError(
      "CADENCE_USER",
      "CONFLICT",
      "Cadence User maps to the wrong Auth subject.",
    );
  }
  if (
    observed.cadenceUser &&
    observed.cadenceUser.personId !== intent.person.id
  ) {
    throw preparationError(
      "CADENCE_USER",
      "CONFLICT",
      "Cadence User maps to the wrong Person.",
    );
  }
  if (
    activeIdentities.length === 1 &&
    (!account ||
      activeIdentities[0].providerSubjectId !== account.providerSubjectId)
  ) {
    throw preparationError(
      "AUTHENTICATION_IDENTITY",
      "CONFLICT",
      "Active authentication identity has no exact provider account mapping.",
    );
  }
  if (
    activeIdentities.length === 1 &&
    activeIdentities[0].personId !== intent.person.id
  ) {
    throw preparationError("AUTHENTICATION_IDENTITY", "CONFLICT", "Authentication identity maps to the wrong Person.");
  }
  void context;
  return account;
}


function isActiveIdentity(identity: AuthenticationIdentity): boolean {
  return identity.status === "ACTIVE" && identity.validTo === null;
}


function uniqueIdentities(
  identities: readonly AuthenticationIdentity[],
): AuthenticationIdentity[] {
  return [...new Map(identities.map((identity) => [identity.id, identity])).values()];
}


function sameCadenceUser(
  first: PilotCadenceUserRecord,
  second: PilotCadenceUserRecord,
): boolean {
  return first.id === second.id &&
    first.authUserId === second.authUserId &&
    first.personId === second.personId &&
    first.username === second.username &&
    first.displayName === second.displayName &&
    first.email === second.email &&
    first.status === second.status &&
    first.identityProvider === second.identityProvider;
}


function sameAuthenticationIdentity(
  first: AuthenticationIdentity,
  second: AuthenticationIdentity,
): boolean {
  return first.id === second.id &&
    first.personId === second.personId &&
    first.provider === second.provider &&
    first.providerSubjectId === second.providerSubjectId &&
    first.loginIdentifier.toLowerCase() === second.loginIdentifier.toLowerCase() &&
    first.validFrom === second.validFrom &&
    first.validTo === second.validTo &&
    first.status === second.status;
}


function preparationError(
  category: PilotPreparationErrorCategory,
  code: PilotPreparationError["code"],
  message: string,
): PilotPreparationError {
  return new PilotPreparationError(category, code, message);
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
