import { SupabaseClient } from "@supabase/supabase-js";
import { IdentityRepository } from "../../modules/identity/identity.repository";
import { CadenceUser } from "../../modules/identity/identity.types";

export class SupabaseIdentityRepository
  implements IdentityRepository {

  constructor(
    private readonly db: SupabaseClient
  ) {}

  async findByAuthSubject(
    authSubject: string
  ): Promise<CadenceUser | null> {

    const { data, error } = await this.db
      .from("users")
      .select(`
        id,
        display_name,
        email,
        status,
        identity_provider
      `)
      .eq("auth_user_id", authSubject)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      displayName: data.display_name,
      email: data.email,
      status: data.status,
      identityProvider: data.identity_provider,
    };
  }
}