import type {
  ProjectRoleTransferRecord,
} from "./project-role-management.repository";


/** Read-only protected-role ledger boundary for controlled preparation. */
export interface ProjectRoleTransferReadRepository {
  listProtectedRoleTransfers(
    projectId: string,
  ): Promise<ProjectRoleTransferRecord[]>;
}
