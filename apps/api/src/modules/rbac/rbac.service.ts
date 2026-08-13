import { RbacRepository } from "./rbac.repository";

export class RbacService {

  constructor(
    private readonly repository: RbacRepository
  ) {}

  async getProjectAccess(
    userId: string,
    projectId: string
  ) {
    return this.repository.getProjectAccess(
      userId,
      projectId
    );
  }

  async hasPermission(
    userId: string,
    projectId: string,
    permissionCode: string
  ): Promise<boolean> {

    const access =
      await this.repository.getProjectAccess(
        userId,
        projectId
      );

    if (!access) {
      return false;
    }

    return access.permissions.includes(
      permissionCode
    );
  }
}