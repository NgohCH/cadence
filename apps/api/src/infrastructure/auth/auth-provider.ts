export interface AuthenticatedIdentity {
  externalUserId: string;
  email: string | null;
}

export interface AuthProvider {
  verifyAccessToken(
    accessToken: string
  ): Promise<AuthenticatedIdentity>;
}