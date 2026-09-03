import type {
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "./project-member-admission.repository";
import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";
import type {
  ChangeOrdinaryRolePersistenceResult,
  ProjectRoleManagementRepository,
  ProjectRoleTransferRecord,
  TransferProtectedRolePersistenceResult,
} from "./project-role-management.repository";
import type {
  ProjectRoleAssignment,
} from "./project-role.types";
import type {
  ProjectRoleTransferReadRepository,
} from "./project-role-transfer-read.repository";
import type {
  ProjectRoleAssignmentReadRepository,
} from "./project-role-assignment-read.repository";
import {
  type PilotMembershipPreparationRequest,
  type PilotOrdinaryRolePreparationRequest,
  type PilotPreparationOutcome,
  type PilotPreparationContext,
  type PilotProtectedRolePreparationRequest,
  type PilotPreparedAction,
  type PilotOrdinaryRolePredecessorIntent,
} from "./pilot-preparation.types";
import {
  isOrdinaryProjectRole,
  isProtectedProjectRole,
} from "./project-role.types";


export type PilotPreparationErrorCategory =
  | "INPUT"
  | "MEMBERSHIP_CONFLICT"
  | "ORDINARY_ROLE_CONFLICT"
  | "PROTECTED_ROLE_CONFLICT"
  | "STALE_PLAN"
  | "PERSISTENCE_FAILURE";


export class ProjectMembershipPilotPreparationError extends Error {
  readonly category: PilotPreparationErrorCategory;
  readonly resourceKey: string;
  readonly operatorPersonId: string | undefined;
  readonly runCorrelationId: string | undefined;

  constructor(
    category: PilotPreparationErrorCategory,
    message: string,
    resourceKey: string,
    context?: PilotPreparationContext,
  ) {
    super(message);
    this.name = "ProjectMembershipPilotPreparationError";
    this.category = category;
    this.resourceKey = resourceKey;
    this.operatorPersonId = context?.operatorPersonId;
    this.runCorrelationId = context?.runCorrelationId;
  }
}


export class ProjectMembershipPilotPreparationService {
  constructor(
    private readonly membershipRepository: ProjectMembershipRepository,
    private readonly admissionRepository: ProjectMemberAdmissionRepository,
    private readonly roleManagementRepository: ProjectRoleManagementRepository,
    private readonly transferReadRepository: ProjectRoleTransferReadRepository,
    private readonly roleAssignmentReadRepository: ProjectRoleAssignmentReadRepository,
    private readonly currentTime: () => string = () => new Date().toISOString(),
  ) {}

  async prepareMembership(
    request: PilotMembershipPreparationRequest,
  ): Promise<PilotPreparationOutcome> {
    validateContext(request.intent.resourceKey, request.context);
    validateMembershipIntent(request);

    const existing = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.membershipRepository.findMembershipById(request.intent.membershipId),
    );
    const memberships = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.membershipRepository.listMembershipsForPersonInProject(
        request.intent.personId,
        request.intent.projectId,
      ),
    );

    if (existing && !membershipMatches(existing, request)) {
      throw preparationError(
        "MEMBERSHIP_CONFLICT",
        "Existing canonical membership conflicts with prepared intent.",
        request,
      );
    }

    const overlap = memberships.find(
      (candidate) =>
        candidate.id !== request.intent.membershipId &&
        candidate.status === "ACTIVE" &&
        membershipPeriodsOverlap(candidate, request),
    );
    if (overlap) {
      throw preparationError(
        "MEMBERSHIP_CONFLICT",
        "An overlapping canonical membership exists.",
        request,
      );
    }

    if (existing) {
      return outcome(request.intent.resourceKey, request.action, "REUSED", existing.id, request.context, request.intent.projectId);
    }

    if (request.action === "REUSE") {
      throw preparationError(
        "STALE_PLAN",
        "Prepared Membership reuse target is absent.",
        request,
      );
    }

    const createdAt = this.currentTime();
    let admission: ProjectMemberAdmissionResult;
    try {
      admission = await persistSafely(
        request.intent.resourceKey,
        request.context,
        () => this.admissionRepository.addProjectMember({
          correlationId: request.context.runCorrelationId,
          membership: {
            id: request.intent.membershipId,
            projectId: request.intent.projectId,
            personId: request.intent.personId,
            effectiveFrom: request.intent.effectiveFrom,
            effectiveTo: request.intent.effectiveTo,
            status: "ACTIVE",
            grantedBy: request.intent.grantedByPersonId,
            createdAt,
            terminationReason: null,
          },
          roleAssignment: {
            id: request.intent.initialRoleAssignmentId,
            projectId: request.intent.projectId,
            membershipId: request.intent.membershipId,
            role: "PROJECT_MEMBER",
            effectiveFrom: request.intent.effectiveFrom,
            effectiveTo: request.intent.effectiveTo,
            assignedBy: request.intent.grantedByPersonId,
            changeReason: null,
            createdAt,
          },
        }),
      );
    } catch (error) {
      const raced = await readSafely(
        request.intent.resourceKey,
        request.context,
        () => this.membershipRepository.findMembershipById(request.intent.membershipId),
      );
      if (raced && membershipMatches(raced, request)) {
        return outcome(request.intent.resourceKey, request.action, "REUSED", raced.id, request.context, request.intent.projectId);
      }
      throw error;
    }

    if (
      !membershipMatches(admission.membership, request) ||
      admission.roleAssignment.id !== request.intent.initialRoleAssignmentId ||
      admission.roleAssignment.projectId !== request.intent.projectId ||
      admission.roleAssignment.membershipId !== request.intent.membershipId ||
      admission.roleAssignment.role !== "PROJECT_MEMBER" ||
      admission.roleAssignment.effectiveFrom !== request.intent.effectiveFrom ||
      admission.roleAssignment.effectiveTo !== request.intent.effectiveTo ||
      admission.roleAssignment.assignedBy !== request.intent.grantedByPersonId
    ) {
      throw preparationError(
        "MEMBERSHIP_CONFLICT",
        "Membership admission returned an incompatible postcondition.",
        request,
      );
    }

    return outcome(request.intent.resourceKey, request.action, "CREATED", admission.membership.id, request.context, request.intent.projectId);
  }

  async prepareOrdinaryRoleAssignment(
    request: PilotOrdinaryRolePreparationRequest,
  ): Promise<PilotPreparationOutcome> {
    validateContext(request.intent.resourceKey, request.context);
    validateOrdinaryIntent(request);

    const membership = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.membershipRepository.findMembershipById(request.intent.membershipId),
    );
    if (
      !membership ||
      membership.projectId !== request.intent.projectId ||
      membership.status !== "ACTIVE" ||
      !isEffectiveAt(membership.effectiveFrom, membership.effectiveTo, request.intent.effectiveFrom)
    ) {
      throw preparationError(
        request.action === "REUSE" ? "STALE_PLAN" : "ORDINARY_ROLE_CONFLICT",
        "Prepared ordinary role requires an effective canonical membership.",
        request,
      );
    }

    const assignments = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.membershipRepository.listRoleAssignments(request.intent.membershipId),
    );
    const expectedPredecessor = request.intent.expectedPredecessor;
    const overlapping = assignments.filter(
      (assignment) =>
        assignment.id !== request.intent.assignmentId &&
        assignment.id !== expectedPredecessor?.assignmentId &&
        isOrdinaryProjectRole(assignment.role) &&
        periodsOverlap(
          assignment.effectiveFrom,
          assignment.effectiveTo,
          request.intent.effectiveFrom,
          request.intent.effectiveTo,
        ),
    );
    if (overlapping.length > 0) {
      throw preparationError(
        "ORDINARY_ROLE_CONFLICT",
        "An undeclared overlapping ordinary role assignment exists.",
        request,
      );
    }

    const exact = assignments.find(
      (assignment) =>
        assignment.id === request.intent.assignmentId,
    );
    if (exact && !ordinaryAssignmentMatches(exact, request)) {
      throw preparationError(
        "ORDINARY_ROLE_CONFLICT",
        "Existing ordinary role assignment conflicts with prepared intent.",
        request,
      );
    }

    if (exact) {
      if (
        expectedPredecessor &&
        !predecessorClosedMatches(
          assignments.find((assignment) => assignment.id === expectedPredecessor.assignmentId),
          expectedPredecessor,
          request.intent.effectiveFrom,
        )
      ) {
        throw preparationError(
          "ORDINARY_ROLE_CONFLICT",
          "Declared ordinary-role predecessor conflicts with canonical history.",
          request,
        );
      }
      return outcome(request.intent.resourceKey, request.action, "REUSED", exact.id, request.context, request.intent.projectId);
    }

    const effectiveOrdinary = assignments.filter(
      (assignment) =>
        isOrdinaryProjectRole(assignment.role) &&
        isEffectiveAt(assignment.effectiveFrom, assignment.effectiveTo, request.intent.effectiveFrom),
    );
    if (effectiveOrdinary.length > 1) {
      throw preparationError(
        "ORDINARY_ROLE_CONFLICT",
        "Multiple effective ordinary role assignments exist.",
        request,
      );
    }

    if (request.intent.role !== "PROJECT_MEMBER" && !expectedPredecessor) {
      throw preparationError(
        "ORDINARY_ROLE_CONFLICT",
        "An ordinary-role replacement must declare its exact predecessor.",
        request,
      );
    }

    if (expectedPredecessor) {
      const predecessor = assignments.find(
        (assignment) => assignment.id === expectedPredecessor.assignmentId,
      );
      if (
        !predecessorMatches(predecessor, expectedPredecessor) ||
        effectiveOrdinary.length !== 1 ||
        effectiveOrdinary[0]?.id !== expectedPredecessor.assignmentId
      ) {
        throw preparationError(
          "ORDINARY_ROLE_CONFLICT",
          "The exact declared ordinary-role predecessor is not effective and compatible.",
          request,
        );
      }
    }

    if (request.action === "REUSE") {
      throw preparationError(
        "STALE_PLAN",
        "Prepared ordinary role reuse target is absent.",
        request,
      );
    }

    let persisted: ChangeOrdinaryRolePersistenceResult;
    try {
      persisted = await persistSafely(
        request.intent.resourceKey,
        request.context,
        () => this.roleManagementRepository.changeOrdinaryRole({
          assignmentId: request.intent.assignmentId,
          projectId: request.intent.projectId,
          membershipId: request.intent.membershipId,
          role: request.intent.role,
          effectiveAt: request.intent.effectiveFrom,
          assignedByPersonId: request.intent.assignedByPersonId,
          changeReason: request.intent.changeReason,
          correlationId: request.context.runCorrelationId,
          createdAt: this.currentTime(),
        }),
      );
    } catch (error) {
      const raced = await readSafely(
        request.intent.resourceKey,
        request.context,
        () => this.membershipRepository.listRoleAssignments(request.intent.membershipId),
      );
      const exactRaced = raced.find((assignment) => assignment.id === request.intent.assignmentId);
      const predecessorRaced = request.intent.expectedPredecessor
        ? raced.find((assignment) => assignment.id === request.intent.expectedPredecessor?.assignmentId)
        : undefined;
      if (
        exactRaced &&
        ordinaryAssignmentMatches(exactRaced, request) &&
        (!request.intent.expectedPredecessor ||
          (predecessorRaced && predecessorClosedMatches(
            predecessorRaced,
            request.intent.expectedPredecessor,
            request.intent.effectiveFrom,
          )))
      ) {
        return outcome(request.intent.resourceKey, request.action, "REUSED", exactRaced.id, request.context, request.intent.projectId);
      }
      throw error;
    }
    const closedAssignmentIsValid = expectedPredecessor
      ? persisted.closedAssignment !== null &&
        predecessorClosedMatches(persisted.closedAssignment, expectedPredecessor, request.intent.effectiveFrom)
      : persisted.closedAssignment === null;
    if (!closedAssignmentIsValid || !ordinaryAssignmentMatches(persisted.roleAssignment, request)) {
      throw preparationError(
        "ORDINARY_ROLE_CONFLICT",
        "Ordinary role persistence returned an incompatible postcondition.",
        request,
      );
    }
    return outcome(request.intent.resourceKey, request.action, "CREATED", persisted.roleAssignment.id, request.context, request.intent.projectId);
  }

  async prepareProtectedRoleAppointment(
    request: PilotProtectedRolePreparationRequest,
  ): Promise<PilotPreparationOutcome> {
    validateContext(request.intent.resourceKey, request.context);
    validateProtectedIntent(request);

    const membership = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.membershipRepository.findMembershipById(request.intent.membershipId),
    );
    if (
      !membership ||
      membership.projectId !== request.intent.projectId ||
      membership.status !== "ACTIVE" ||
      !isEffectiveAt(membership.effectiveFrom, membership.effectiveTo, request.intent.effectiveAt)
    ) {
      throw preparationError(
        request.action === "REUSE" ? "STALE_PLAN" : "PROTECTED_ROLE_CONFLICT",
        "Prepared protected appointment requires an effective canonical membership.",
        request,
      );
    }

    const assignments = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.roleAssignmentReadRepository.listRoleAssignmentsForProject(request.intent.projectId),
    );
    const projectRoleAssignments = assignments.filter(
      (assignment) =>
        assignment.projectId === request.intent.projectId &&
        assignment.role === request.intent.role,
    );
    const allRoleAssignments = projectRoleAssignments;
    const effective = allRoleAssignments.filter(
      (assignment) => isEffectiveAt(assignment.effectiveFrom, assignment.effectiveTo, request.intent.effectiveAt),
    );
    const transfers = await readSafely(
      request.intent.resourceKey,
      request.context,
      () => this.transferReadRepository.listProtectedRoleTransfers(request.intent.projectId),
    );
    const roleTransfers = transfers.filter((transfer) => transfer.role === request.intent.role);

    if (effective.length > 1) {
      throw preparationError("PROTECTED_ROLE_CONFLICT", "Multiple effective protected-role holders exist.", request);
    }

    if (effective.length === 1) {
      const holder = effective[0];
      const exactLedger = roleTransfers.filter((transfer) => protectedTransferMatches(transfer, request, holder.id));
      if (protectedAssignmentMatches(holder, request) && exactLedger.length === 1) {
        return outcome(request.intent.resourceKey, request.action, "REUSED", holder.id, request.context, request.intent.projectId);
      }
      throw preparationError(
        "PROTECTED_ROLE_CONFLICT",
        holder.membershipId === request.intent.membershipId
          ? "Protected role holder or immutable ledger conflicts with prepared intent."
          : "A different protected role holder exists; bootstrap cannot transfer it.",
        request,
      );
    }

    if (allRoleAssignments.length > 0 || roleTransfers.length > 0) {
      throw preparationError("PROTECTED_ROLE_CONFLICT", "Protected role history is contradictory without an effective holder.", request);
    }
    if (request.action === "REUSE") {
      throw preparationError("STALE_PLAN", "Prepared protected appointment target is absent.", request);
    }

    let persisted: TransferProtectedRolePersistenceResult;
    try {
      persisted = await persistSafely(
        request.intent.resourceKey,
        request.context,
        () => this.roleManagementRepository.transferProtectedRole({
          transferId: request.intent.transferId,
          incomingAssignmentId: request.intent.assignmentId,
          projectId: request.intent.projectId,
          incomingMembershipId: request.intent.membershipId,
          role: request.intent.role,
          effectiveAt: request.intent.effectiveAt,
          authorisedByPersonId: request.intent.authorisedByPersonId,
          reason: request.intent.reason,
          correlationId: request.context.runCorrelationId,
          createdAt: this.currentTime(),
        }),
      );
    } catch (error) {
      const racedAssignments = await readSafely(
        request.intent.resourceKey,
        request.context,
        () => this.roleAssignmentReadRepository.listRoleAssignmentsForProject(request.intent.projectId),
      );
      const racedTransfers = await readSafely(
        request.intent.resourceKey,
        request.context,
        () => this.transferReadRepository.listProtectedRoleTransfers(request.intent.projectId),
      );
      const exactAssignment = racedAssignments.find(
        (assignment) => assignment.id === request.intent.assignmentId,
      );
      const exactLedger = racedTransfers.filter(
        (transfer) => transfer.role === request.intent.role &&
          protectedTransferMatches(transfer, request, request.intent.assignmentId),
      );
      const effectiveProtected = racedAssignments.filter(
        (assignment) => assignment.projectId === request.intent.projectId &&
          assignment.role === request.intent.role &&
          isEffectiveAt(assignment.effectiveFrom, assignment.effectiveTo, request.intent.effectiveAt),
      );
      if (
        exactAssignment &&
        protectedAssignmentMatches(exactAssignment, request) &&
        effectiveProtected.length === 1 &&
        exactLedger.length === 1
      ) {
        return outcome(request.intent.resourceKey, request.action, "REUSED", exactAssignment.id, request.context, request.intent.projectId);
      }
      throw error;
    }
    if (
      persisted.outgoingAssignment !== null ||
      !protectedAssignmentMatches(persisted.roleAssignment, request) ||
      !protectedTransferMatches(persisted.transfer, request, persisted.roleAssignment.id)
    ) {
      throw preparationError(
        "PROTECTED_ROLE_CONFLICT",
        "Protected appointment persistence returned an incompatible or transferred postcondition.",
        request,
      );
    }
    return outcome(request.intent.resourceKey, request.action, "CREATED", persisted.roleAssignment.id, request.context, request.intent.projectId);
  }
}


function validateContext(resourceKey: string, context: PilotPreparationContext): void {
  if (!resourceKey.trim() || !context.operatorPersonId.trim() || !context.runCorrelationId.trim()) {
    throw new ProjectMembershipPilotPreparationError("INPUT", "Prepared Membership context is invalid.", resourceKey, context);
  }
}


function validateMembershipIntent(request: PilotMembershipPreparationRequest): void {
  const intent = request.intent;
  if (
    request.action !== "CREATE" && request.action !== "REUSE" ||
    intent.status !== "ACTIVE" ||
    !intent.membershipId.trim() ||
    !intent.projectId.trim() ||
    !intent.personId.trim() ||
    !intent.grantedByPersonId.trim() ||
    !isValidPeriod(intent.effectiveFrom, intent.effectiveTo)
  ) {
    throw preparationError("INPUT", "Prepared membership intent is invalid.", request);
  }
  if (intent.grantedByPersonId !== request.context.operatorPersonId) {
    throw preparationError("INPUT", "Membership grantor must be the named bootstrap operator.", request);
  }
}


function validateOrdinaryIntent(request: PilotOrdinaryRolePreparationRequest): void {
  const intent = request.intent;
  if (
    (request.action !== "CREATE" && request.action !== "REUSE") ||
    !isOrdinaryProjectRole(intent.role) ||
    !intent.assignmentId.trim() ||
    !intent.projectId.trim() ||
    !intent.membershipId.trim() ||
    !intent.assignedByPersonId.trim() ||
    !isValidPeriod(intent.effectiveFrom, intent.effectiveTo)
  ) {
    throw preparationError("INPUT", "Prepared ordinary role intent is invalid.", request);
  }
  if (intent.assignedByPersonId !== request.context.operatorPersonId) {
    throw preparationError("INPUT", "Ordinary role assigner must be the named bootstrap operator.", request);
  }
}


function validateProtectedIntent(request: PilotProtectedRolePreparationRequest): void {
  const intent = request.intent;
  if (
    (request.action !== "APPOINT" && request.action !== "REUSE") ||
    !isProtectedProjectRole(intent.role) ||
    !intent.assignmentId.trim() ||
    !intent.transferId.trim() ||
    !intent.projectId.trim() ||
    !intent.membershipId.trim() ||
    !intent.authorisedByPersonId.trim() ||
    !intent.reason.trim() ||
    !isValidTimestamp(intent.effectiveAt) ||
    !isValidTimestampOrNull(intent.effectiveTo)
  ) {
    throw preparationError("INPUT", "Prepared protected appointment intent is invalid.", request);
  }
  if (intent.authorisedByPersonId !== request.context.operatorPersonId) {
    throw preparationError("INPUT", "Protected appointment authoriser must be the named bootstrap operator.", request);
  }
}


function membershipMatches(
  existing: {
    id: string;
    projectId: string;
    personId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    status: string;
    grantedBy: string | null;
  },
  request: PilotMembershipPreparationRequest,
): boolean {
  const intent = request.intent;
  return existing.id === intent.membershipId &&
    existing.projectId === intent.projectId &&
    existing.personId === intent.personId &&
    existing.effectiveFrom === intent.effectiveFrom &&
    existing.effectiveTo === intent.effectiveTo &&
    existing.status === "ACTIVE" &&
    existing.grantedBy === intent.grantedByPersonId;
}


function ordinaryAssignmentMatches(
  assignment: ProjectRoleAssignment,
  request: PilotOrdinaryRolePreparationRequest,
): boolean {
  const intent = request.intent;
  return assignment.id === intent.assignmentId &&
    assignment.projectId === intent.projectId &&
    assignment.membershipId === intent.membershipId &&
    assignment.role === intent.role &&
    assignment.effectiveFrom === intent.effectiveFrom &&
    assignment.effectiveTo === intent.effectiveTo &&
    assignment.assignedBy === intent.assignedByPersonId &&
    assignment.changeReason === intent.changeReason;
}


function predecessorMatches(
  assignment: ProjectRoleAssignment | undefined,
  expected: PilotOrdinaryRolePredecessorIntent,
): boolean {
  return assignment !== undefined &&
    assignment.id === expected.assignmentId &&
    assignment.projectId === expected.projectId &&
    assignment.membershipId === expected.membershipId &&
    assignment.role === expected.role &&
    assignment.effectiveFrom === expected.effectiveFrom &&
    assignment.effectiveTo === expected.effectiveTo &&
    assignment.assignedBy === expected.assignedByPersonId &&
    assignment.changeReason === expected.changeReason;
}


function predecessorClosedMatches(
  assignment: ProjectRoleAssignment | undefined,
  expected: PilotOrdinaryRolePredecessorIntent,
  closedAt: string,
): boolean {
  return predecessorMatches(assignment, {
    ...expected,
    effectiveTo: closedAt,
  });
}


function protectedAssignmentMatches(
  assignment: ProjectRoleAssignment,
  request: PilotProtectedRolePreparationRequest,
): boolean {
  const intent = request.intent;
  return assignment.id === intent.assignmentId &&
    assignment.projectId === intent.projectId &&
    assignment.membershipId === intent.membershipId &&
    assignment.role === intent.role &&
    assignment.effectiveFrom === intent.effectiveAt &&
    assignment.effectiveTo === intent.effectiveTo &&
    assignment.assignedBy === intent.authorisedByPersonId &&
    assignment.changeReason === intent.reason;
}


function protectedTransferMatches(
  transfer: ProjectRoleTransferRecord,
  request: PilotProtectedRolePreparationRequest,
  incomingAssignmentId: string,
): boolean {
  const intent = request.intent;
  return transfer.id === intent.transferId &&
    transfer.projectId === intent.projectId &&
    transfer.role === intent.role &&
    transfer.outgoingAssignmentId === null &&
    transfer.incomingAssignmentId === incomingAssignmentId &&
    transfer.authorisedByPersonId === intent.authorisedByPersonId &&
    transfer.reason === intent.reason &&
    transfer.correlationId === request.context.runCorrelationId &&
    transfer.effectiveAt === intent.effectiveAt;
}


function membershipPeriodsOverlap(
  existing: { effectiveFrom: string; effectiveTo: string | null },
  request: PilotMembershipPreparationRequest,
): boolean {
  return periodsOverlap(
    existing.effectiveFrom,
    existing.effectiveTo,
    request.intent.effectiveFrom,
    request.intent.effectiveTo,
  );
}


function periodsOverlap(
  firstFrom: string,
  firstTo: string | null,
  secondFrom: string,
  secondTo: string | null,
): boolean {
  const firstEnd = firstTo ? Date.parse(firstTo) : Number.POSITIVE_INFINITY;
  const secondEnd = secondTo ? Date.parse(secondTo) : Number.POSITIVE_INFINITY;
  return Date.parse(firstFrom) < secondEnd && Date.parse(secondFrom) < firstEnd;
}


function isEffectiveAt(
  effectiveFrom: string,
  effectiveTo: string | null,
  instant: string,
): boolean {
  const at = Date.parse(instant);
  return Date.parse(effectiveFrom) <= at &&
    (effectiveTo === null || at < Date.parse(effectiveTo));
}


function isValidPeriod(from: string, to: string | null): boolean {
  if (!isValidTimestamp(from) || !isValidTimestampOrNull(to)) return false;
  return to === null || Date.parse(from) < Date.parse(to);
}


function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}


function isValidTimestampOrNull(value: string | null): boolean {
  return value === null || isValidTimestamp(value);
}


function outcome(
  resourceKey: string,
  plannedAction: PilotPreparedAction | "APPOINT",
  actualResult: "CREATED" | "REUSED",
  resourceId: string,
  context: PilotPreparationContext,
  projectId: string,
): PilotPreparationOutcome {
  return {
    resourceKey,
    plannedAction,
    actualResult,
    resourceId,
    projectId,
    operatorPersonId: context.operatorPersonId,
    runCorrelationId: context.runCorrelationId,
  };
}


function preparationError<T extends { intent: { resourceKey: string }; context: PilotPreparationContext }>(
  category: PilotPreparationErrorCategory,
  message: string,
  request: T,
): ProjectMembershipPilotPreparationError {
  return new ProjectMembershipPilotPreparationError(
    category,
    `${category}: ${message}`,
    request.intent.resourceKey,
    request.context,
  );
}


async function readSafely<T>(
  resourceKey: string,
  context: PilotPreparationContext,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch {
    throw new ProjectMembershipPilotPreparationError(
      "PERSISTENCE_FAILURE",
      "PERSISTENCE_FAILURE: Membership state read failed.",
      resourceKey,
      context,
    );
  }
}


async function persistSafely<T>(
  resourceKey: string,
  context: PilotPreparationContext,
  persist: () => Promise<T>,
): Promise<T> {
  try {
    return await persist();
  } catch {
    throw new ProjectMembershipPilotPreparationError(
      "PERSISTENCE_FAILURE",
      "PERSISTENCE_FAILURE: Membership persistence failed.",
      resourceKey,
      context,
    );
  }
}
