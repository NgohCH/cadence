/**
 * Stable human identity inside Cadence.
 *
 * Authentication accounts, login identifiers, affiliations, and project
 * memberships are deliberately represented by separate domain concepts.
 */
export interface CadencePerson {
  id: string;
  displayName: string;
}


export const ORGANISATIONAL_AFFILIATIONS = [
  "INTERNAL",
  "EXTERNAL",
] as const;

export type OrganisationalAffiliationClassification =
  typeof ORGANISATIONAL_AFFILIATIONS[number];


/**
 * A time-varying relationship with an organisation.
 *
 * Affiliation is descriptive identity data. It grants no project authority.
 */
export interface OrganisationalAffiliation {
  personId: string;
  classification:
    OrganisationalAffiliationClassification;
  organisationName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}


export const AUTHENTICATION_IDENTITY_STATUSES = [
  "ACTIVE",
  "DISABLED",
] as const;

export type AuthenticationIdentityStatus =
  typeof AUTHENTICATION_IDENTITY_STATUSES[number];


/**
 * A replaceable way for a stable Cadence Person to authenticate.
 *
 * The provider subject and login identifier are authentication data only.
 * This representation intentionally contains no project membership, role,
 * or permission authority.
 */
export interface AuthenticationIdentity {
  id: string;
  personId: string;
  provider: string;
  providerSubjectId: string;
  loginIdentifier: string;
  validFrom: string;
  validTo: string | null;
  status: AuthenticationIdentityStatus;
}


/**
 * VS-001 compatibility projection returned by the current identity
 * repository and exposed by GET /api/v1/me.
 *
 * Its id remains the authoritative actorUserId for the existing request
 * path. VS002-02 establishes an explicit persistence bridge to the stable
 * Person model without changing that working authentication flow.
 */
export interface CadenceUser {
  id: string;
  personId: string;
  displayName: string;
  email: string;
  status: "active" | "disabled";
  identityProvider: string;
}
