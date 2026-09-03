export interface AdministrativeAuthAccount {
  provider: string;
  providerSubjectId: string;
  loginIdentifier: string;
  status: "active" | "disabled";
}


export interface AdministrativeAuthLookup {
  provider: string;
  loginIdentifier: string;
  providerSubjectId?: string;
}


export interface AdministrativeAuthCreateRequest
  extends AdministrativeAuthLookup {
  manifestUserKey: string;
}


export interface AdministrativeAuthCredentials {
  /** Runtime-only first-account credential; never persisted or returned. */
  readonly password?: string;
}


export interface AdministrativeAuthProvider {
  findAccounts(
    input: AdministrativeAuthLookup,
  ): Promise<readonly AdministrativeAuthAccount[]>;

  createAccount(
    input: AdministrativeAuthCreateRequest,
    credentials: AdministrativeAuthCredentials,
  ): Promise<AdministrativeAuthAccount>;
}
