import type {
  AdministrativeAuthProvider,
} from "../src/infrastructure/auth/administrative-auth-provider";
import type {
  PilotAuthAccountReader,
} from "./vs004-controlled-pilot-preflight";
import type {
  ProjectMembershipPilotObservationRepository,
} from "../src/modules/project-membership/pilot-observation.repository";
import type {
  ProjectMembershipRepository,
} from "../src/modules/project-membership/project-membership.repository";
import type {
  ProjectRoleAssignmentReadRepository,
} from "../src/modules/project-membership/project-role-assignment-read.repository";
import type {
  ProjectRoleTransferReadRepository,
} from "../src/modules/project-membership/project-role-transfer-read.repository";


export interface MembershipObservationReads {
  readonly memberships: Pick<
    ProjectMembershipRepository,
    "listMembershipsForProject"
  >;
  readonly roleAssignments: Pick<
    ProjectRoleAssignmentReadRepository,
    "listRoleAssignmentsForProject"
  >;
  readonly protectedTransfers: Pick<
    ProjectRoleTransferReadRepository,
    "listProtectedRoleTransfers"
  >;
}


export function createMembershipPilotObservationSource(
  reads: MembershipObservationReads,
): ProjectMembershipPilotObservationRepository {
  return {
    listMembershipsForProject: (projectId) =>
      reads.memberships.listMembershipsForProject(projectId),
    listRoleAssignmentsForProject: (projectId) =>
      reads.roleAssignments.listRoleAssignmentsForProject(projectId),
    listProtectedRoleTransfers: (projectId) =>
      reads.protectedTransfers.listProtectedRoleTransfers(projectId),
  };
}


export function createReadOnlyAuthAccountReader(
  provider: Pick<AdministrativeAuthProvider, "findAccounts">,
): PilotAuthAccountReader {
  return {
    findAccounts: (input) => provider.findAccounts(input),
  };
}
