import type {
  AuthenticationIdentity,
  CadencePerson,
  CadenceUser,
  OrganisationalAffiliation,
} from "./identity.types";

export interface IdentityRepository {
  findByAuthSubject(
    authSubject: string
  ): Promise<CadenceUser | null>;
}


/**
 * VS002-02 persistence owned by Identity.
 *
 * This is separate from the VS-001 authentication-resolution contract so the
 * working CadenceUser request path can remain unchanged during the migration.
 */
export interface IdentityPersistenceRepository {
  createPerson(
    person: CadencePerson
  ): Promise<CadencePerson>;

  findPersonById(
    personId: string
  ): Promise<CadencePerson | null>;

  createAuthenticationIdentity(
    identity: AuthenticationIdentity
  ): Promise<AuthenticationIdentity>;

  listAuthenticationIdentities(
    personId: string
  ): Promise<AuthenticationIdentity[]>;

  createOrganisationalAffiliation(
    affiliation: OrganisationalAffiliation
  ): Promise<OrganisationalAffiliation>;

  listOrganisationalAffiliations(
    personId: string
  ): Promise<OrganisationalAffiliation[]>;
}
