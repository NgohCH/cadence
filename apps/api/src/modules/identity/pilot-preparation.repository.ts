import type {
  AuthenticationIdentity,
  CadencePerson,
} from "./identity.types";
import type { PilotCadenceUserRecord } from "./pilot-preparation.types";


export interface IdentityPilotPreparationRepository {
  findPersonById(personId: string): Promise<CadencePerson | null>;
  createPerson(person: CadencePerson): Promise<CadencePerson>;

  findCadenceUserById(userId: string): Promise<PilotCadenceUserRecord | null>;
  createCadenceUser(user: PilotCadenceUserRecord): Promise<PilotCadenceUserRecord>;

  listAuthenticationIdentities(personId: string): Promise<AuthenticationIdentity[]>;
  findAuthenticationIdentitiesByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<AuthenticationIdentity[]>;
  findAuthenticationIdentitiesById(
    identityId: string,
  ): Promise<AuthenticationIdentity[]>;
  createAuthenticationIdentity(
    identity: AuthenticationIdentity,
  ): Promise<AuthenticationIdentity>;
}
