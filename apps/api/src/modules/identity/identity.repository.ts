import type { CadenceUser } from "./identity.types";

export interface IdentityRepository {
  findByAuthSubject(
    authSubject: string
  ): Promise<CadenceUser | null>;
}