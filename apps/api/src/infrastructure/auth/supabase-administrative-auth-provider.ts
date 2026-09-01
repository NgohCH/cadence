import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthCreateRequest,
  AdministrativeAuthCredentials,
  AdministrativeAuthLookup,
  AdministrativeAuthProvider,
} from "./administrative-auth-provider";


const PAGE_SIZE = 1000;


export class SupabaseAdministrativeAuthProvider
  implements AdministrativeAuthProvider
{
  constructor(
    private readonly client: SupabaseClient,
  ) {}

  async findAccounts(
    input: AdministrativeAuthLookup,
  ): Promise<readonly AdministrativeAuthAccount[]> {
    const users = await this.listAllUsers();
    return users
      .map((user) => toAccount(user, input.provider))
      .filter(
        (account) =>
          account.loginIdentifier.toLowerCase() ===
            input.loginIdentifier.toLowerCase() ||
          (input.providerSubjectId !== undefined &&
            account.providerSubjectId === input.providerSubjectId),
      );
  }

  async createAccount(
    input: AdministrativeAuthCreateRequest,
    credentials: AdministrativeAuthCredentials,
  ): Promise<AdministrativeAuthAccount> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.loginIdentifier,
      ...(credentials.password !== undefined
        ? { password: credentials.password }
        : {}),
      email_confirm: true,
      user_metadata: {
        cadence_pilot_user_key: input.manifestUserKey,
      },
    });
    if (error || !data.user) {
      throw error ?? new Error("Administrative Auth provider returned no user.");
    }
    return toAccount(data.user, input.provider);
  }

  private async listAllUsers(): Promise<readonly SupabaseAuthUser[]> {
    const users: SupabaseAuthUser[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) {
        throw error;
      }
      const pageUsers = (data?.users ?? []) as SupabaseAuthUser[];
      users.push(...pageUsers);
      if (pageUsers.length < PAGE_SIZE) {
        return users;
      }
      page += 1;
    }
  }
}


interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  banned_until?: string | null;
}


function toAccount(
  user: SupabaseAuthUser,
  provider: string,
): AdministrativeAuthAccount {
  if (!user.email) {
    throw new Error("Administrative Auth account has no login identifier.");
  }
  return {
    provider,
    providerSubjectId: user.id,
    loginIdentifier: user.email,
    status: user.banned_until ? "disabled" : "active",
  };
}
