import type {
  AuthenticationIdentity,
  CadencePerson,
} from "./identity.types";
import type {
  PilotCadenceUserRecord,
} from "./pilot-preparation.types";


/**
 * Read-only Identity boundary used by controlled pilot preflight.
 * Preparation and persistence mutation contracts are intentionally absent.
 */
export interface IdentityPilotObservationRepository {
  findPersonById(personId: string): Promise<CadencePerson | null>;
  findCadenceUserById(userId: string): Promise<PilotCadenceUserRecord | null>;
  listAuthenticationIdentities(personId: string): Promise<AuthenticationIdentity[]>;
  findAuthenticationIdentitiesByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<AuthenticationIdentity[]>;
  findAuthenticationIdentitiesById(
    identityId: string,
  ): Promise<AuthenticationIdentity[]>;
}
