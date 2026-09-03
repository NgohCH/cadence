import {
  computeManifestHash,
  validatePilotManifest,
  type PilotEnvironment,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import type {
  PreparedPilotExecution,
} from "./vs004-controlled-pilot-preflight";
import type {
  PilotExecutionOutcome,
  PilotExecutionResult,
} from "./vs004-controlled-pilot-execution";
import type {
  PilotPlanOperation,
  PilotPlanOperationKind,
  PilotPlanOrdinaryRolePredecessor,
} from "./vs004-preflight";


export const PREPARED_ARTIFACT_TYPE =
  "cadence.vs004.prepared-pilot-execution" as const;
export const RESULT_ARTIFACT_TYPE =
  "cadence.vs004.pilot-execution-result" as const;
export const FAILURE_ARTIFACT_TYPE =
  "cadence.vs004.pilot-execution-failure" as const;
export const CURRENT_ARTIFACT_FORMAT_VERSION = 1 as const;


export interface PreparedPilotExecutionEnvelope {
  readonly artifactType: typeof PREPARED_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly preparedExecution: PreparedPilotExecution;
}


export interface PilotExecutionResultEnvelope {
  readonly artifactType: typeof RESULT_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly result: PilotExecutionResult;
}


export interface PilotExecutionFailureEvidence {
  readonly manifestId?: string;
  readonly manifestHash?: string;
  readonly runCorrelationId: string;
  readonly target?: PreparedPilotExecution["target"];
  readonly category: string;
  readonly failedOperation?: Readonly<{
    resourceKey: string;
    kind: string;
  }>;
  readonly completedOutcomes: readonly PilotExecutionOutcome[];
  readonly executionCompleted: boolean;
  readonly completedResult?: PilotExecutionResult;
  readonly recordedAt: string;
}


export interface PilotExecutionFailureEnvelope {
  readonly artifactType: typeof FAILURE_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly failure: PilotExecutionFailureEvidence;
}


export class PilotArtifactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotArtifactValidationError";
  }
}


const PILOT_PLAN_OPERATION_KINDS: readonly PilotPlanOperationKind[] = [
  "CREATE_PERSON",
  "CREATE_CADENCE_USER",
  "CREATE_AUTH_ACCOUNT",
  "CREATE_AUTH_IDENTITY",
  "CREATE_PROJECT",
  "CREATE_PROJECT_HEALTH",
  "ADD_PROJECT_MEMBER",
  "CHANGE_ORDINARY_ROLE",
  "APPOINT_PROTECTED_ROLE",
  "REUSE",
];

const PILOT_ENVIRONMENTS: readonly PilotEnvironment[] = ["local", "qa", "beta"];
const PROJECT_ROLES = [
  "PROJECT_SPONSOR",
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_MEMBER",
  "PROJECT_OBSERVER",
  "PROJECT_AUDITOR",
] as const;
const PILOT_EXECUTION_MODULES = [
  "Identity",
  "Projects",
  "Project Health",
  "Project Membership",
] as const;
const CREDENTIAL_KEYS = new Set([
  "password",
  "secret",
  "secretkey",
  "servicerolekey",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "bearertoken",
  "error",
  "stack",
  "providerresponse",
  "databaseresponse",
  "sql",
]);


export function serializePreparedPilotExecutionArtifact(
  prepared: PreparedPilotExecution,
): string {
  assertPreparedPilotExecution(prepared);
  const envelope: PreparedPilotExecutionEnvelope = {
    artifactType: PREPARED_ARTIFACT_TYPE,
    formatVersion: CURRENT_ARTIFACT_FORMAT_VERSION,
    preparedExecution: prepared,
  };
  return JSON.stringify(envelope);
}


export function parsePreparedPilotExecutionArtifact(
  serialized: string,
): PreparedPilotExecution {
  const envelope = parseSerializedEnvelope(
    serialized,
    PREPARED_ARTIFACT_TYPE,
    "preparedExecution",
  );
  const prepared = envelope.preparedExecution;
  assertPreparedPilotExecution(prepared);
  return prepared;
}


export function serializePilotExecutionResultArtifact(
  result: PilotExecutionResult,
): string {
  assertPilotExecutionResult(result);
  const envelope: PilotExecutionResultEnvelope = {
    artifactType: RESULT_ARTIFACT_TYPE,
    formatVersion: CURRENT_ARTIFACT_FORMAT_VERSION,
    result,
  };
  return JSON.stringify(envelope);
}


export function parsePilotExecutionResultArtifact(
  serialized: string,
): PilotExecutionResult {
  const envelope = parseSerializedEnvelope(
    serialized,
    RESULT_ARTIFACT_TYPE,
    "result",
  );
  const result = envelope.result;
  assertPilotExecutionResult(result);
  return result;
}


export function serializePilotExecutionFailureArtifact(
  failure: PilotExecutionFailureEvidence,
): string {
  assertPilotExecutionFailureEvidence(failure);
  const envelope: PilotExecutionFailureEnvelope = {
    artifactType: FAILURE_ARTIFACT_TYPE,
    formatVersion: CURRENT_ARTIFACT_FORMAT_VERSION,
    failure,
  };
  return JSON.stringify(envelope);
}


export function parsePilotExecutionFailureArtifact(
  serialized: string,
): PilotExecutionFailureEvidence {
  const envelope = parseSerializedEnvelope(
    serialized,
    FAILURE_ARTIFACT_TYPE,
    "failure",
  );
  const failure = envelope.failure;
  assertPilotExecutionFailureEvidence(failure);
  return failure;
}


function parseSerializedEnvelope(
  serialized: string,
  artifactType: string,
  payloadKey: string,
): Record<string, unknown> {
  if (typeof serialized !== "string") {
    throw invalidArtifact("Serialized artifact must be a string.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw invalidArtifact("Serialized artifact JSON is malformed.");
  }

  rejectCredentialFields(parsed, "artifact");
  const envelope = record(parsed, "artifact");
  exactKeys(
    envelope,
    new Set(["artifactType", "formatVersion", payloadKey]),
    "artifact",
  );
  literalString(envelope.artifactType, artifactType, "artifactType");
  literalNumber(
    envelope.formatVersion,
    CURRENT_ARTIFACT_FORMAT_VERSION,
    "formatVersion",
  );
  if (!(payloadKey in envelope)) {
    throw invalidArtifact(`Artifact is missing ${payloadKey}.`);
  }
  return envelope;
}


function assertPreparedPilotExecution(
  value: unknown,
): asserts value is PreparedPilotExecution {
  rejectCredentialFields(value, "preparedExecution");
  const prepared = record(value, "preparedExecution");
  exactKeys(
    prepared,
    new Set([
      "manifestId",
      "manifestHash",
      "target",
      "operatorPersonId",
      "runCorrelationId",
      "validatedManifest",
      "observedEvidence",
      "preflightPlan",
    ]),
    "preparedExecution",
  );
  nonBlankString(prepared.manifestId, "preparedExecution.manifestId");
  nonBlankString(prepared.manifestHash, "preparedExecution.manifestHash");
  nonBlankString(prepared.operatorPersonId, "preparedExecution.operatorPersonId");
  nonBlankString(prepared.runCorrelationId, "preparedExecution.runCorrelationId");
  assertPilotTarget(prepared.target, "preparedExecution.target");
  const validatedManifest = validateManifest(prepared.validatedManifest);
  if (computeManifestHash(validatedManifest) !== prepared.manifestHash) {
    throw invalidArtifact("Prepared manifestHash does not match validatedManifest.");
  }
  assertObservedEvidence(prepared.observedEvidence);
  assertPilotPreflightPlan(prepared.preflightPlan);
}


function assertPilotExecutionResult(
  value: unknown,
): asserts value is PilotExecutionResult {
  rejectCredentialFields(value, "result");
  const result = record(value, "result");
  exactKeys(
    result,
    new Set([
      "manifestId",
      "manifestHash",
      "runCorrelationId",
      "target",
      "startedAt",
      "completedAt",
      "outcomes",
    ]),
    "result",
  );
  nonBlankString(result.manifestId, "result.manifestId");
  nonBlankString(result.manifestHash, "result.manifestHash");
  nonBlankString(result.runCorrelationId, "result.runCorrelationId");
  assertPilotTarget(result.target, "result.target");
  timestamp(result.startedAt, "result.startedAt");
  timestamp(result.completedAt, "result.completedAt");
  const outcomes = array(result.outcomes, "result.outcomes");
  outcomes.forEach((outcome, index) =>
    assertPilotExecutionOutcome(outcome, `result.outcomes[${index}]`));
}


function assertPilotExecutionFailureEvidence(
  value: unknown,
): asserts value is PilotExecutionFailureEvidence {
  rejectCredentialFields(value, "failure");
  const failure = record(value, "failure");
  exactKeys(
    failure,
    new Set([
      "manifestId",
      "manifestHash",
      "runCorrelationId",
      "target",
      "category",
      "failedOperation",
      "completedOutcomes",
      "executionCompleted",
      "completedResult",
      "recordedAt",
    ]),
    "failure",
  );
  if (failure.manifestId !== undefined) {
    nonBlankString(failure.manifestId, "failure.manifestId");
  }
  if (failure.manifestHash !== undefined) {
    nonBlankString(failure.manifestHash, "failure.manifestHash");
  }
  nonBlankString(failure.runCorrelationId, "failure.runCorrelationId");
  if (failure.target !== undefined) {
    assertPilotTarget(failure.target, "failure.target");
  }
  nonBlankString(failure.category, "failure.category");
  if (failure.failedOperation !== undefined) {
    assertFailedOperation(failure.failedOperation, "failure.failedOperation");
  }
  const outcomes = array(failure.completedOutcomes, "failure.completedOutcomes");
  outcomes.forEach((outcome, index) =>
    assertPilotExecutionOutcome(outcome, `failure.completedOutcomes[${index}]`));
  boolean(failure.executionCompleted, "failure.executionCompleted");
  if (failure.executionCompleted) {
    if (failure.completedResult === undefined) {
      throw invalidArtifact("Completed failure evidence requires completedResult.");
    }
    assertPilotExecutionResult(failure.completedResult);
  } else if (failure.completedResult !== undefined) {
    throw invalidArtifact("Incomplete failure evidence cannot contain completedResult.");
  }
  timestamp(failure.recordedAt, "failure.recordedAt");
}


function assertPilotTarget(value: unknown, path: string): void {
  const target = record(value, path);
  exactKeys(
    target,
    new Set([
      "environment",
      "supabaseUrl",
      "supabaseProjectRef",
      "projectId",
      "safeTargetMarker",
    ]),
    path,
  );
  oneOf(target.environment, PILOT_ENVIRONMENTS, `${path}.environment`);
  nonBlankString(target.supabaseUrl, `${path}.supabaseUrl`);
  nullableString(target.supabaseProjectRef, `${path}.supabaseProjectRef`);
  nonBlankString(target.projectId, `${path}.projectId`);
  nonBlankString(target.safeTargetMarker, `${path}.safeTargetMarker`);
}


function assertPilotPlanTarget(value: unknown, path: string): void {
  const target = record(value, path);
  exactKeys(target, new Set(["environment", "projectId", "safeTargetMarker"]), path);
  oneOf(target.environment, PILOT_ENVIRONMENTS, `${path}.environment`);
  nonBlankString(target.projectId, `${path}.projectId`);
  nonBlankString(target.safeTargetMarker, `${path}.safeTargetMarker`);
}


function assertObservedEvidence(value: unknown): void {
  const evidence = record(value, "preparedExecution.observedEvidence");
  exactKeys(
    evidence,
    new Set([
      "observedAt",
      "userCount",
      "personCount",
      "cadenceUserCount",
      "authenticationIdentityCount",
      "authAccountCount",
      "projectCount",
      "membershipCount",
      "roleAssignmentCount",
      "protectedTransferCount",
    ]),
    "preparedExecution.observedEvidence",
  );
  timestamp(evidence.observedAt, "preparedExecution.observedEvidence.observedAt");
  for (const key of [
    "userCount",
    "personCount",
    "cadenceUserCount",
    "authenticationIdentityCount",
    "authAccountCount",
    "projectCount",
    "membershipCount",
    "roleAssignmentCount",
    "protectedTransferCount",
  ]) {
    nonNegativeInteger(evidence[key], `preparedExecution.observedEvidence.${key}`);
  }
}


function assertPilotPreflightPlan(value: unknown): void {
  const plan = record(value, "preparedExecution.preflightPlan");
  exactKeys(
    plan,
    new Set([
      "manifestId",
      "manifestHash",
      "target",
      "operatorPersonId",
      "runCorrelationId",
      "operations",
    ]),
    "preparedExecution.preflightPlan",
  );
  nonBlankString(plan.manifestId, "preparedExecution.preflightPlan.manifestId");
  nonBlankString(plan.manifestHash, "preparedExecution.preflightPlan.manifestHash");
  assertPilotPlanTarget(plan.target, "preparedExecution.preflightPlan.target");
  nonBlankString(
    plan.operatorPersonId,
    "preparedExecution.preflightPlan.operatorPersonId",
  );
  nonBlankString(
    plan.runCorrelationId,
    "preparedExecution.preflightPlan.runCorrelationId",
  );
  const operations = array(plan.operations, "preparedExecution.preflightPlan.operations");
  operations.forEach((operation, index) =>
    assertPilotPlanOperation(
      operation,
      `preparedExecution.preflightPlan.operations[${index}]`,
    ));
}


function assertPilotPlanOperation(value: unknown, path: string): void {
  const operation = record(value, path);
  exactKeys(
    operation,
    new Set([
      "kind",
      "resourceKey",
      "manifestKey",
      "id",
      "progressPercent",
      "role",
      "reason",
      "expectedPredecessor",
    ]),
    path,
  );
  oneOf(operation.kind, PILOT_PLAN_OPERATION_KINDS, `${path}.kind`);
  nonBlankString(operation.resourceKey, `${path}.resourceKey`);
  if (operation.manifestKey !== undefined) {
    nonBlankString(operation.manifestKey, `${path}.manifestKey`);
  }
  if (operation.id !== undefined) {
    nonBlankString(operation.id, `${path}.id`);
  }
  if (operation.progressPercent !== undefined) {
    boundedInteger(operation.progressPercent, 0, 100, `${path}.progressPercent`);
  }
  if (operation.role !== undefined) {
    oneOf(operation.role, PROJECT_ROLES, `${path}.role`);
  }
  if (operation.reason !== undefined) {
    nonBlankString(operation.reason, `${path}.reason`);
  }
  if (operation.expectedPredecessor !== undefined) {
    assertPilotPlanPredecessor(
      operation.expectedPredecessor,
      `${path}.expectedPredecessor`,
    );
  }
}


function assertPilotPlanPredecessor(
  value: unknown,
  path: string,
): asserts value is PilotPlanOrdinaryRolePredecessor {
  const predecessor = record(value, path);
  exactKeys(
    predecessor,
    new Set([
      "assignmentId",
      "projectId",
      "membershipId",
      "role",
      "effectiveFrom",
      "effectiveTo",
      "assignedByPersonId",
      "changeReason",
    ]),
    path,
  );
  nonBlankString(predecessor.assignmentId, `${path}.assignmentId`);
  nonBlankString(predecessor.projectId, `${path}.projectId`);
  nonBlankString(predecessor.membershipId, `${path}.membershipId`);
  oneOf(
    predecessor.role,
    ["PROJECT_MEMBER", "PROJECT_OBSERVER", "PROJECT_AUDITOR"],
    `${path}.role`,
  );
  timestamp(predecessor.effectiveFrom, `${path}.effectiveFrom`);
  nullableTimestamp(predecessor.effectiveTo, `${path}.effectiveTo`);
  nonBlankString(predecessor.assignedByPersonId, `${path}.assignedByPersonId`);
  nullableString(predecessor.changeReason, `${path}.changeReason`);
}


function assertPilotExecutionOutcome(value: unknown, path: string): void {
  const outcome = record(value, path);
  exactKeys(
    outcome,
    new Set([
      "resourceKey",
      "plannedOperation",
      "owningModule",
      "resourceId",
      "actualResult",
      "operatorPersonId",
      "runCorrelationId",
    ]),
    path,
  );
  nonBlankString(outcome.resourceKey, `${path}.resourceKey`);
  oneOf(outcome.plannedOperation, PILOT_PLAN_OPERATION_KINDS, `${path}.plannedOperation`);
  oneOf(outcome.owningModule, PILOT_EXECUTION_MODULES, `${path}.owningModule`);
  nonBlankString(outcome.resourceId, `${path}.resourceId`);
  oneOf(outcome.actualResult, ["CREATED", "REUSED"], `${path}.actualResult`);
  nonBlankString(outcome.operatorPersonId, `${path}.operatorPersonId`);
  nonBlankString(outcome.runCorrelationId, `${path}.runCorrelationId`);
}


function assertFailedOperation(value: unknown, path: string): void {
  const operation = record(value, path);
  exactKeys(operation, new Set(["resourceKey", "kind"]), path);
  nonBlankString(operation.resourceKey, `${path}.resourceKey`);
  nonBlankString(operation.kind, `${path}.kind`);
}


function validateManifest(value: unknown): ValidatedPilotManifest {
  try {
    return validatePilotManifest(value);
  } catch {
    throw invalidArtifact("Validated manifest is malformed.");
  }
}


function rejectCredentialFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => rejectCredentialFields(child, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (CREDENTIAL_KEYS.has(normalizeKey(key))) {
      throw invalidArtifact(`Credential-bearing field is not permitted: ${path}.${key}.`);
    }
    rejectCredentialFields(child, `${path}.${key}`);
  }
}


function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidArtifact(`${path} must be an object.`);
  }
  return value;
}


function exactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw invalidArtifact(`${path}.${key} is not a supported artifact field.`);
    }
  }
}


function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidArtifact(`${path} must be an array.`);
  }
  return value;
}


function nonBlankString(value: unknown, path: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidArtifact(`${path} must be a nonblank string.`);
  }
}


function nullableString(value: unknown, path: string): void {
  if (value !== null) {
    nonBlankString(value, path);
  }
}


function literalString(value: unknown, expected: string, path: string): void {
  if (value !== expected) {
    throw invalidArtifact(`${path} is unsupported or incorrect.`);
  }
}


function literalNumber(value: unknown, expected: number, path: string): void {
  if (value !== expected) {
    throw invalidArtifact(`${path} is unsupported or incorrect.`);
  }
}


function boolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") {
    throw invalidArtifact(`${path} must be a boolean.`);
  }
}


function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): void {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw invalidArtifact(`${path} is unsupported.`);
  }
}


function nonNegativeInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || !Number.isFinite(value) || (value as number) < 0) {
    throw invalidArtifact(`${path} must be a non-negative integer.`);
  }
}


function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): void {
  if (
    !Number.isInteger(value) ||
    !Number.isFinite(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw invalidArtifact(`${path} must be an integer between ${minimum} and ${maximum}.`);
  }
}


function timestamp(value: unknown, path: string): void {
  nonBlankString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value as string)) {
    throw invalidArtifact(`${path} must be an ISO timestamp.`);
  }
  if (!Number.isFinite(Date.parse(value as string))) {
    throw invalidArtifact(`${path} must be a valid ISO timestamp.`);
  }
}


function nullableTimestamp(value: unknown, path: string): void {
  if (value !== null) {
    timestamp(value, path);
  }
}


function invalidArtifact(message: string): PilotArtifactValidationError {
  return new PilotArtifactValidationError(message);
}
