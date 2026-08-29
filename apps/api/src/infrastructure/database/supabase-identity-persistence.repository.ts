import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  IdentityPersistenceRepository,
} from "../../modules/identity/identity.repository";

import type {
  AuthenticationIdentity,
  CadencePerson,
  OrganisationalAffiliation,
} from "../../modules/identity/identity.types";


type PersonRow = {
  id: string;
  display_name: string;
};

type AuthenticationIdentityRow = {
  id: string;
  person_id: string;
  provider: string;
  provider_subject_id: string;
  login_identifier: string;
  valid_from: string;
  valid_to: string | null;
  status: AuthenticationIdentity["status"];
};

type OrganisationalAffiliationRow = {
  person_id: string;
  classification:
    OrganisationalAffiliation["classification"];
  organisation_name: string | null;
  effective_from: string;
  effective_to: string | null;
};


export class SupabaseIdentityPersistenceRepository
  implements IdentityPersistenceRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}

  async searchPeople(query: string, limit = 20): Promise<CadencePerson[]> {
    const { data, error } = await this.db.from("persons").select("id, display_name").ilike("display_name", `%${query.trim()}%`).order("display_name", { ascending: true }).limit(Math.min(Math.max(limit, 1), 50));
    if (error) throw error;
    return ((data ?? []) as PersonRow[]).map(mapPerson);
  }


  async createPerson(
    person: CadencePerson
  ): Promise<CadencePerson> {
    const {
      data,
      error,
    } = await this.db
      .from("persons")
      .insert({
        id: person.id,
        display_name: person.displayName,
      })
      .select("id, display_name")
      .single();

    if (error) {
      throw error;
    }

    return mapPerson(
      data as PersonRow
    );
  }


  async findPersonById(
    personId: string
  ): Promise<CadencePerson | null> {
    const {
      data,
      error,
    } = await this.db
      .from("persons")
      .select("id, display_name")
      .eq("id", personId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? mapPerson(data as PersonRow)
      : null;
  }


  async createAuthenticationIdentity(
    identity: AuthenticationIdentity
  ): Promise<AuthenticationIdentity> {
    const {
      data,
      error,
    } = await this.db
      .from("authentication_identities")
      .insert({
        id: identity.id,
        person_id: identity.personId,
        provider: identity.provider,
        provider_subject_id:
          identity.providerSubjectId,
        login_identifier:
          identity.loginIdentifier,
        valid_from: identity.validFrom,
        valid_to: identity.validTo,
        status: identity.status,
      })
      .select(`
        id,
        person_id,
        provider,
        provider_subject_id,
        login_identifier,
        valid_from,
        valid_to,
        status
      `)
      .single();

    if (error) {
      throw error;
    }

    return mapAuthenticationIdentity(
      data as AuthenticationIdentityRow
    );
  }


  async listAuthenticationIdentities(
    personId: string
  ): Promise<AuthenticationIdentity[]> {
    const {
      data,
      error,
    } = await this.db
      .from("authentication_identities")
      .select(`
        id,
        person_id,
        provider,
        provider_subject_id,
        login_identifier,
        valid_from,
        valid_to,
        status
      `)
      .eq("person_id", personId)
      .order("valid_from", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as
        AuthenticationIdentityRow[]
    ).map(mapAuthenticationIdentity);
  }


  async createOrganisationalAffiliation(
    affiliation: OrganisationalAffiliation
  ): Promise<OrganisationalAffiliation> {
    const {
      data,
      error,
    } = await this.db
      .from("organisational_affiliations")
      .insert({
        person_id: affiliation.personId,
        classification:
          affiliation.classification,
        organisation_name:
          affiliation.organisationName,
        effective_from:
          affiliation.effectiveFrom,
        effective_to:
          affiliation.effectiveTo,
      })
      .select(`
        person_id,
        classification,
        organisation_name,
        effective_from,
        effective_to
      `)
      .single();

    if (error) {
      throw error;
    }

    return mapOrganisationalAffiliation(
      data as OrganisationalAffiliationRow
    );
  }


  async listOrganisationalAffiliations(
    personId: string
  ): Promise<OrganisationalAffiliation[]> {
    const {
      data,
      error,
    } = await this.db
      .from("organisational_affiliations")
      .select(`
        person_id,
        classification,
        organisation_name,
        effective_from,
        effective_to
      `)
      .eq("person_id", personId)
      .order("effective_from", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as
        OrganisationalAffiliationRow[]
    ).map(mapOrganisationalAffiliation);
  }
}


function mapPerson(
  row: PersonRow
): CadencePerson {
  return {
    id: row.id,
    displayName: row.display_name,
  };
}


function mapAuthenticationIdentity(
  row: AuthenticationIdentityRow
): AuthenticationIdentity {
  return {
    id: row.id,
    personId: row.person_id,
    provider: row.provider,
    providerSubjectId:
      row.provider_subject_id,
    loginIdentifier:
      row.login_identifier,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    status: row.status,
  };
}


function mapOrganisationalAffiliation(
  row: OrganisationalAffiliationRow
): OrganisationalAffiliation {
  return {
    personId: row.person_id,
    classification: row.classification,
    organisationName:
      row.organisation_name,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}
