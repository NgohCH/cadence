import { IdentityRepository } from "./identity.repository";
import { CadenceUser } from "./identity.types";

export class IdentityService {
  constructor(
    private readonly repository: IdentityRepository
  ) {}

  async resolveAuthenticatedUser(
    authSubject: string
  ): Promise<CadenceUser> {

    const user =
      await this.repository.findByAuthSubject(
        authSubject
      );

    if (!user) {
      throw new Error("CADENCE_USER_NOT_FOUND");
    }

    if (user.status !== "active") {
      throw new Error("CADENCE_USER_DISABLED");
    }

    return user;
  }
}