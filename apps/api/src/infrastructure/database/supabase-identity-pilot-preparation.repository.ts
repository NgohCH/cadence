import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthenticationIdentity,
} from "../../modules/identity/identity.types";
import type {
  IdentityPilotPreparationRepository,
} from "../../modules/identity/pilot-preparation.repository";
import type {
  PilotCadenceUserRecord,
} from "../../modules/identity/pilot-preparation.types";
import {
  SupabaseIdentityPersistenceRepository,
} from "./supabase-identity-persistence.repository";


type CadenceUserRow = {
  id: string;
  auth_user_id: string;
  person_id: string;
  username: string;
  display_name: string;
  email: string;
  status: "active";
  identity_provider: string;
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


/**
 * Identity-owned persistence adapter for the controlled pilot primitive.
 * It adds exact Cadence User reads/creates to the existing Identity
 * persistence foundation without exposing update, delete, or upsert methods.
 */
export class SupabaseIdentityPilotPreparationRepository
  extends SupabaseIdentityPersistenceRepository
  implements IdentityPilotPreparationRepository
{
  constructor(
    private readonly client: SupabaseClient,
  ) {
    super(client);
  }

  async findCadenceUserById(
    userId: string,
  ): Promise<PilotCadenceUserRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .select(`
        id,
        auth_user_id,
        person_id,
        username,
        display_name,
        email,
        status,
        identity_provider
      `)
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? mapCadenceUser(data as CadenceUserRow) : null;
  }

  async createCadenceUser(
    user: PilotCadenceUserRecord,
  ): Promise<PilotCadenceUserRecord> {
    const { data, error } = await this.client
      .from("users")
      .insert({
        id: user.id,
        auth_user_id: user.authUserId,
        person_id: user.personId,
        username: user.username,
        display_name: user.displayName,
        email: user.email,
        status: user.status,
        identity_provider: user.identityProvider,
      })
      .select(`
        id,
        auth_user_id,
        person_id,
        username,
        display_name,
        email,
        status,
        identity_provider
      `)
      .single();
    if (error) {
      throw error;
    }
    return mapCadenceUser(data as CadenceUserRow);
  }

  async findAuthenticationIdentitiesByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<AuthenticationIdentity[]> {
    const { data, error } = await this.client
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
      .eq("provider", provider)
      .eq("provider_subject_id", providerSubjectId)
      .order("valid_from", { ascending: true });
    if (error) {
      throw error;
    }
    return ((data ?? []) as AuthenticationIdentityRow[]).map(
      mapAuthenticationIdentity,
    );
  }

  async findAuthenticationIdentitiesById(
    identityId: string,
  ): Promise<AuthenticationIdentity[]> {
    const { data, error } = await this.client
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
      .eq("id", identityId)
      .order("valid_from", { ascending: true });
    if (error) {
      throw error;
    }
    return ((data ?? []) as AuthenticationIdentityRow[]).map(
      mapAuthenticationIdentity,
    );
  }
}


function mapCadenceUser(
  row: CadenceUserRow,
): PilotCadenceUserRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    personId: row.person_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    identityProvider: row.identity_provider,
  };
}


function mapAuthenticationIdentity(
  row: AuthenticationIdentityRow,
): AuthenticationIdentity {
  return {
    id: row.id,
    personId: row.person_id,
    provider: row.provider,
    providerSubjectId: row.provider_subject_id,
    loginIdentifier: row.login_identifier,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    status: row.status,
  };
}
