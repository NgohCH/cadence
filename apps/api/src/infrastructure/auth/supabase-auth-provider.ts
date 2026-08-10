import { createClient } from "@supabase/supabase-js";
import {
  AuthProvider,
  AuthenticatedIdentity,
} from "./auth-provider";

export class SupabaseAuthProvider implements AuthProvider {
  private readonly client;

  constructor(
    supabaseUrl: string,
    supabasePublishableKey: string
  ) {
    this.client = createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  async verifyAccessToken(
    accessToken: string
  ): Promise<AuthenticatedIdentity> {

    const {
      data,
      error,
    } = await this.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new Error("AUTH_TOKEN_INVALID");
    }

    return {
      externalUserId: data.user.id,
      email: data.user.email ?? null,
    };
  }
}