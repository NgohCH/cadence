import type {
  AuthenticationIdentity,
  CadencePerson,
} from "./identity.types";


export interface PilotCadenceUserRecord {
  id: string;
  authUserId: string;
  personId: string;
  username: string;
  displayName: string;
  email: string;
  status: "active";
  identityProvider: string;
}


export interface PilotIdentityPreparationIntent {
  manifestUserKey: string;
  person: {
    kind: "existing" | "new";
    id: string;
    displayName: string;
  };
  cadenceUser: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    status: "active";
    identityProvider: string;
  };
  authentication: {
    identityId?: string;
    provider: string;
    providerSubjectId?: string;
    loginIdentifier: string;
    validFrom: string;
    validTo: string | null;
  };
}


export interface PilotIdentityPreparationContext {
  operatorPersonId: string;
  runCorrelationId: string;
  /** Supplied by protected runtime configuration and never persisted/returned. */
  password?: string;
}


export type PilotPreparedResource =
  | "AUTH_ACCOUNT"
  | "PERSON"
  | "CADENCE_USER"
  | "AUTHENTICATION_IDENTITY";


export interface PilotPreparationResourceEvidence {
  resource: PilotPreparedResource;
  status: "CREATED" | "REUSED";
  id: string;
}


export interface PilotPreparationEvidence {
  manifestUserKey: string;
  personId: string;
  cadenceUserId: string;
  provider: string;
  providerSubjectId: string;
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotPreparationFailureEvidence {
  manifestUserKey: string;
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotIdentityPreparationResult {
  resources: readonly PilotPreparationResourceEvidence[];
  evidence: PilotPreparationEvidence;
}


export type PilotPreparationErrorCategory =
  | "INPUT"
  | "PROVIDER"
  | "PERSON"
  | "CADENCE_USER"
  | "AUTHENTICATION_IDENTITY";


export interface PilotIdentitySnapshot {
  person: CadencePerson | null;
  cadenceUser: PilotCadenceUserRecord | null;
  authenticationIdentities: readonly AuthenticationIdentity[];
}
