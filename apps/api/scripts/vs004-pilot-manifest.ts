import { createHash } from "node:crypto";

import {
  PROJECT_ROLES,
  type ProjectRole,
} from "../src/modules/project-membership/project-role.types";


export const PILOT_ENVIRONMENTS = [
  "local",
  "qa",
  "beta",
] as const;

export type PilotEnvironment =
  typeof PILOT_ENVIRONMENTS[number];


export const PILOT_MANIFEST_ROLES = PROJECT_ROLES;


export interface PilotTargetDeclaration {
  environment: PilotEnvironment;
  supabaseProjectRef: string | null;
  safeTargetMarker: string;
  projectId: string;
}


export interface PilotOperatorIntent {
  personId: string;
  displayName: string;
}


export interface PilotPersonIntent {
  kind: "existing" | "new";
  id: string;
  displayName?: string;
}


export interface PilotCadenceUserIntent {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: "active";
  identityProvider: string;
}


export interface PilotAuthenticationIntent {
  identityId?: string;
  provider: string;
  providerSubjectId?: string;
  loginIdentifier: string;
}


export interface PilotMembershipIntent {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  grantedByPersonId: string;
  initialRoleAssignmentId: string;
}


export interface PilotHealthIntent {
  status: "on_track" | "at_risk" | "delayed" | "blocked";
  reasons: readonly string[];
  source: string;
  changedBy: string | null;
}


export interface PilotProjectIntent {
  id: string;
  marker: string;
  name: string;
  description: string | null;
  goal: string | null;
  lifecycleStatus:
    | "draft"
    | "active"
    | "on_hold"
    | "completed"
    | "cancelled";
  ownerUserId: string;
  startDate: string | null;
  targetDate: string | null;
  health: PilotHealthIntent;
}


export interface PilotUserIntent {
  key: string;
  displayName: string;
  affiliation: "INTERNAL";
  person: PilotPersonIntent;
  cadenceUser: PilotCadenceUserIntent;
  authentication: PilotAuthenticationIntent;
  membership: PilotMembershipIntent;
  role: ProjectRole;
  roleAssignmentId: string;
  protectedTransferId?: string;
  protectedRoleReason?: string;
}


export interface GovernedRoleOverlapScenario {
  id: string;
  personId: string;
  roles: readonly ProjectRole[];
  reason: string;
}


export interface PilotManifest {
  manifestVersion: string;
  manifestId: string;
  target: PilotTargetDeclaration;
  operator: PilotOperatorIntent;
  project: PilotProjectIntent;
  users: readonly PilotUserIntent[];
  governedRoleOverlapScenarios?: readonly GovernedRoleOverlapScenario[];
}


export type ValidatedPilotManifest = Readonly<PilotManifest>;


export class PilotManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotManifestValidationError";
  }
}


const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const PROTECTED_ROLES = new Set<ProjectRole>([
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_SPONSOR",
]);

const REQUIRED_DEFAULT_ROLES = [
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_SPONSOR",
  "PROJECT_MEMBER",
] as const satisfies readonly ProjectRole[];


export function validatePilotManifest(
  input: unknown
): ValidatedPilotManifest {
  rejectCredentialFields(input, "manifest");

  const root = record(input, "manifest");
  if ("projects" in root) {
    throw invalid(
      "Manifest must declare exactly one real pilot project."
    );
  }

  knownKeys(
    root,
    [
      "manifestVersion",
      "manifestId",
      "target",
      "operator",
      "project",
      "users",
      "governedRoleOverlapScenarios",
    ],
    "manifest"
  );

  const manifestVersion =
    nonBlankString(root.manifestVersion, "manifestVersion");
  const manifestId =
    nonBlankString(root.manifestId, "manifestId");

  const target =
    validateTarget(root.target);
  const operator =
    validateOperator(root.operator);
  const project =
    validateProject(root.project);

  if (project.id !== target.projectId) {
    throw invalid(
      "project.id must match target.projectId."
    );
  }

  const usersValue = root.users;
  if (!Array.isArray(usersValue)) {
    throw invalid("users must be an array.");
  }

  if (usersValue.length < 5 || usersValue.length > 10) {
    throw invalid(
      "Manifest must contain between 5 and 10 pilot users."
    );
  }

  const users = usersValue.map(
    (value, index) =>
      validateUser(value, `users[${index}]`)
  );

  const overlapScenarios =
    validateOverlapScenarios(
      root.governedRoleOverlapScenarios
    );

  assertUnique(
    users.map((user) => user.key),
    "manifest key"
  );
  assertUnique(
    users.map((user) =>
      user.authentication.loginIdentifier.toLowerCase()
    ),
    "intended login identifier"
  );
  assertUnique(
    users.map((user) => user.cadenceUser.id),
    "Cadence User ID"
  );

  assertRequiredRoles(users);
  assertDefaultRolePersonDistinctness(
    users,
    overlapScenarios
  );

  if (
    !users.some(
      (user) =>
        user.role === "PROJECT_OWNER" &&
        user.cadenceUser.id === project.ownerUserId
    )
  ) {
    throw invalid(
      "project.ownerUserId must match the intended Owner Cadence User."
    );
  }

  const validated: PilotManifest = {
    manifestVersion,
    manifestId,
    target,
    operator,
    project,
    users,
    ...(overlapScenarios.length > 0
      ? {
          governedRoleOverlapScenarios:
            overlapScenarios,
        }
      : {}),
  };

  return deepFreeze(validated);
}


export function computeManifestHash(
  manifest: ValidatedPilotManifest
): string {
  const canonical = canonicalize(
    manifest,
    []
  );

  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}


function validateTarget(
  input: unknown
): PilotTargetDeclaration {
  if (input === undefined || input === null) {
    throw invalid("target is required.");
  }

  const target = record(input, "target");
  knownKeys(
    target,
    [
      "environment",
      "supabaseProjectRef",
      "safeTargetMarker",
      "projectId",
    ],
    "target"
  );

  const environment =
    nonBlankString(target.environment, "target.environment").toLowerCase();
  if (
    !PILOT_ENVIRONMENTS.includes(
      environment as PilotEnvironment
    )
  ) {
    throw invalid(
      "target.environment must be local, qa, or beta."
    );
  }

  const supabaseProjectRef =
    target.supabaseProjectRef;
  if (
    supabaseProjectRef !== null &&
    typeof supabaseProjectRef !== "string"
  ) {
    throw invalid(
      "target.supabaseProjectRef must be null or a string."
    );
  }

  if (environment === "local" && supabaseProjectRef !== null) {
    throw invalid(
      "local target.supabaseProjectRef must be null."
    );
  }

  if (
    environment !== "local" &&
    (!supabaseProjectRef ||
      !/^[a-z0-9]+$/i.test(supabaseProjectRef))
  ) {
    throw invalid(
      "hosted target.supabaseProjectRef must be a valid project reference."
    );
  }

  return {
    environment: environment as PilotEnvironment,
    supabaseProjectRef,
    safeTargetMarker: nonBlankString(
      target.safeTargetMarker,
      "target.safeTargetMarker"
    ),
    projectId: uuid(
      target.projectId,
      "target.projectId"
    ),
  };
}


function validateOperator(
  input: unknown
): PilotOperatorIntent {
  const operator = record(input, "operator");
  knownKeys(
    operator,
    ["personId", "displayName"],
    "operator"
  );

  return {
    personId: uuid(
      operator.personId,
      "operator.personId"
    ),
    displayName: nonBlankString(
      operator.displayName,
      "operator.displayName"
    ),
  };
}


function validateProject(
  input: unknown
): PilotProjectIntent {
  if (input === undefined || input === null) {
    throw invalid("project is required.");
  }

  const project = record(input, "project");
  knownKeys(
    project,
    [
      "id",
      "marker",
      "name",
      "description",
      "goal",
      "lifecycleStatus",
      "ownerUserId",
      "startDate",
      "targetDate",
      "health",
    ],
    "project"
  );

  const lifecycleStatus =
    nonBlankString(
      project.lifecycleStatus,
      "project.lifecycleStatus"
    );
  if (
    ![
      "draft",
      "active",
      "on_hold",
      "completed",
      "cancelled",
    ].includes(lifecycleStatus)
  ) {
    throw invalid(
      "project.lifecycleStatus is unsupported."
    );
  }

  return {
    id: uuid(project.id, "project.id"),
    marker: nonBlankString(project.marker, "project.marker"),
    name: nonBlankString(project.name, "project.name"),
    description: nullableString(
      project.description,
      "project.description"
    ),
    goal: nullableString(
      project.goal,
      "project.goal"
    ),
    lifecycleStatus: lifecycleStatus as PilotProjectIntent["lifecycleStatus"],
    ownerUserId: uuid(
      project.ownerUserId,
      "project.ownerUserId"
    ),
    startDate: nullableDate(
      project.startDate,
      "project.startDate"
    ),
    targetDate: nullableDate(
      project.targetDate,
      "project.targetDate"
    ),
    health: validateHealth(project.health),
  };
}


function validateHealth(
  input: unknown
): PilotHealthIntent {
  const health = record(input, "project.health");
  knownKeys(
    health,
    ["status", "reasons", "source", "changedBy"],
    "project.health"
  );

  const status =
    nonBlankString(health.status, "project.health.status");
  if (
    ![
      "on_track",
      "at_risk",
      "delayed",
      "blocked",
    ].includes(status)
  ) {
    throw invalid(
      "project.health.status is unsupported."
    );
  }

  if (!Array.isArray(health.reasons)) {
    throw invalid(
      "project.health.reasons must be an array."
    );
  }

  return {
    status: status as PilotHealthIntent["status"],
    reasons: health.reasons.map(
      (reason, index) =>
        nonBlankString(
          reason,
          `project.health.reasons[${index}]`
        )
    ),
    source: nonBlankString(
      health.source,
      "project.health.source"
    ),
    changedBy: nullableString(
      health.changedBy,
      "project.health.changedBy"
    ),
  };
}


function validateUser(
  input: unknown,
  path: string
): PilotUserIntent {
  const user = record(input, path);
  knownKeys(
    user,
    [
      "key",
      "displayName",
      "affiliation",
      "person",
      "cadenceUser",
      "authentication",
      "membership",
      "role",
      "roleAssignmentId",
      "protectedTransferId",
      "protectedRoleReason",
    ],
    path
  );

  const role =
    nonBlankString(user.role, `${path}.role`);
  if (
    !(PILOT_MANIFEST_ROLES as readonly string[]).includes(role)
  ) {
    throw invalid(
      `${path}.role is an unsupported project role.`
    );
  }

  const affiliation =
    nonBlankString(
      user.affiliation,
      `${path}.affiliation`
    );
  if (affiliation !== "INTERNAL") {
    throw invalid(
      "The default M1 pilot must contain INTERNAL users only."
    );
  }

  const personValue =
    record(user.person, `${path}.person`);
  knownKeys(
    personValue,
    ["kind", "id", "displayName"],
    `${path}.person`
  );
  const personKind =
    nonBlankString(
      personValue.kind,
      `${path}.person.kind`
    );
  if (personKind !== "existing" && personKind !== "new") {
    throw invalid(
      `${path}.person.kind must be existing or new.`
    );
  }
  const person: PilotPersonIntent = {
    kind: personKind,
    id: uuid(
      personValue.id,
      `${path}.person.id`
    ),
  };
  if (personKind === "new") {
    person.displayName = nonBlankString(
      personValue.displayName,
      `${path}.person.displayName`
    );
  } else if (personValue.displayName !== undefined) {
    person.displayName = nonBlankString(
      personValue.displayName,
      `${path}.person.displayName`
    );
  }

  const cadenceUser =
    validateCadenceUser(
      user.cadenceUser,
      `${path}.cadenceUser`
    );
  const authentication =
    validateAuthentication(
      user.authentication,
      `${path}.authentication`
    );
  const membership =
    validateMembership(
      user.membership,
      `${path}.membership`
    );

  const protectedRoleReason =
    user.protectedRoleReason === undefined
      ? undefined
      : validateProtectedRoleReason(
          user.protectedRoleReason,
          `${path}.protectedRoleReason`
        );
  const protectedTransferId =
    user.protectedTransferId === undefined
      ? undefined
      : uuid(
          user.protectedTransferId,
          `${path}.protectedTransferId`
        );

  if (PROTECTED_ROLES.has(role as ProjectRole)) {
    if (!protectedRoleReason) {
      throw invalid(
        `${path}.protectedRoleReason is required for protected roles.`
      );
    }
    if (!protectedTransferId) {
      throw invalid(
        `${path}.protectedTransferId is required for protected roles.`
      );
    }
  }

  if (
    role === "PROJECT_MEMBER" &&
    membership.initialRoleAssignmentId !==
      uuid(user.roleAssignmentId, `${path}.roleAssignmentId`)
  ) {
    throw invalid(
      `${path}.roleAssignmentId must equal initialRoleAssignmentId for PROJECT_MEMBER.`
    );
  }

  if (
    role !== "PROJECT_MEMBER" &&
    membership.initialRoleAssignmentId ===
      uuid(user.roleAssignmentId, `${path}.roleAssignmentId`)
  ) {
    throw invalid(
      `${path}.roleAssignmentId must differ from initialRoleAssignmentId when a role transition is required.`
    );
  }

  return {
    key: nonBlankString(user.key, `${path}.key`),
    displayName: nonBlankString(
      user.displayName,
      `${path}.displayName`
    ),
    affiliation: "INTERNAL",
    person,
    cadenceUser,
    authentication,
    membership,
    role: role as ProjectRole,
    roleAssignmentId: uuid(
      user.roleAssignmentId,
      `${path}.roleAssignmentId`
    ),
    ...(protectedTransferId
      ? { protectedTransferId }
      : {}),
    ...(protectedRoleReason
      ? { protectedRoleReason }
      : {}),
  };
}


function validateCadenceUser(
  input: unknown,
  path: string
): PilotCadenceUserIntent {
  const user = record(input, path);
  knownKeys(
    user,
    [
      "id",
      "username",
      "displayName",
      "email",
      "status",
      "identityProvider",
    ],
    path
  );

  if (user.status !== "active") {
    throw invalid(
      `${path}.status must be active for pilot login.`
    );
  }

  return {
    id: uuid(user.id, `${path}.id`),
    username: nonBlankString(
      user.username,
      `${path}.username`
    ),
    displayName: nonBlankString(
      user.displayName,
      `${path}.displayName`
    ),
    email: nonBlankString(
      user.email,
      `${path}.email`
    ),
    status: "active",
    identityProvider: nonBlankString(
      user.identityProvider,
      `${path}.identityProvider`
    ),
  };
}


function validateAuthentication(
  input: unknown,
  path: string
): PilotAuthenticationIntent {
  const authentication = record(input, path);
  knownKeys(
    authentication,
    [
      "identityId",
      "provider",
      "providerSubjectId",
      "loginIdentifier",
    ],
    path
  );

  const identityId =
    authentication.identityId === undefined
      ? undefined
      : uuid(
          authentication.identityId,
          `${path}.identityId`
        );
  const providerSubjectId =
    authentication.providerSubjectId === undefined
      ? undefined
      : nonBlankString(
          authentication.providerSubjectId,
          `${path}.providerSubjectId`
        );

  return {
    ...(identityId ? { identityId } : {}),
    provider: nonBlankString(
      authentication.provider,
      `${path}.provider`
    ),
    ...(providerSubjectId
      ? { providerSubjectId }
      : {}),
    loginIdentifier: nonBlankString(
      authentication.loginIdentifier,
      `${path}.loginIdentifier`
    ),
  };
}


function validateMembership(
  input: unknown,
  path: string
): PilotMembershipIntent {
  const membership = record(input, path);
  knownKeys(
    membership,
    [
      "id",
      "effectiveFrom",
      "effectiveTo",
      "grantedByPersonId",
      "initialRoleAssignmentId",
    ],
    path
  );

  const effectiveFrom = timestamp(
    membership.effectiveFrom,
    `${path}.effectiveFrom`
  );
  const effectiveTo =
    membership.effectiveTo === null
      ? null
      : timestamp(
          membership.effectiveTo,
          `${path}.effectiveTo`
        );
  if (
    effectiveTo !== null &&
    Date.parse(effectiveTo) <= Date.parse(effectiveFrom)
  ) {
    throw invalid(
      `${path}.effectiveTo must be after effectiveFrom.`
    );
  }

  return {
    id: uuid(membership.id, `${path}.id`),
    effectiveFrom,
    effectiveTo,
    grantedByPersonId: uuid(
      membership.grantedByPersonId,
      `${path}.grantedByPersonId`
    ),
    initialRoleAssignmentId: uuid(
      membership.initialRoleAssignmentId,
      `${path}.initialRoleAssignmentId`
    ),
  };
}


function validateProtectedRoleReason(
  value: unknown,
  path: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw invalid(`${path} must be a nonblank string.`);
  }
  return value.trim();
}


function validateOverlapScenarios(
  input: unknown
): GovernedRoleOverlapScenario[] {
  if (input === undefined) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw invalid(
      "governedRoleOverlapScenarios must be an array."
    );
  }

  const scenarios = input.map(
    (value, index) => {
      const path =
        `governedRoleOverlapScenarios[${index}]`;
      const scenario = record(value, path);
      knownKeys(
        scenario,
        ["id", "personId", "roles", "reason"],
        path
      );
      if (!Array.isArray(scenario.roles) || scenario.roles.length < 2) {
        throw invalid(
          `${path}.roles must contain at least two roles.`
        );
      }
      const roles = scenario.roles.map(
        (role, roleIndex) => {
          const value = nonBlankString(
            role,
            `${path}.roles[${roleIndex}]`
          );
          if (
            !(PILOT_MANIFEST_ROLES as readonly string[]).includes(value)
          ) {
            throw invalid(
              `${path}.roles contains an unsupported project role.`
            );
          }
          return value as ProjectRole;
        }
      );
      assertUnique(roles, `${path}.roles entry`);
      return {
        id: nonBlankString(scenario.id, `${path}.id`),
        personId: uuid(
          scenario.personId,
          `${path}.personId`
        ),
        roles,
        reason: nonBlankString(
          scenario.reason,
          `${path}.reason`
        ),
      };
    }
  );

  assertUnique(
    scenarios.map((scenario) => scenario.id),
    "overlap scenario ID"
  );
  return scenarios;
}


function assertRequiredRoles(
  users: readonly PilotUserIntent[]
): void {
  for (const role of REQUIRED_DEFAULT_ROLES) {
    if (!users.some((user) => user.role === role)) {
      throw invalid(`${role} role is required.`);
    }
  }
}


function assertDefaultRolePersonDistinctness(
  users: readonly PilotUserIntent[],
  scenarios: readonly GovernedRoleOverlapScenario[]
): void {
  const requiredUsers = users.filter((user) =>
    (REQUIRED_DEFAULT_ROLES as readonly string[]).includes(user.role)
  );
  const usersByPerson = new Map<string, PilotUserIntent[]>();
  for (const user of requiredUsers) {
    const group = usersByPerson.get(user.person.id) ?? [];
    group.push(user);
    usersByPerson.set(user.person.id, group);
  }

  for (const [personId, group] of usersByPerson) {
    if (group.length === 1) {
      continue;
    }

    const roles = group.map((user) => user.role);
    const governed = scenarios.some(
      (scenario) =>
        scenario.personId === personId &&
        roles.every((role) =>
          scenario.roles.includes(role)
        )
    );

    if (!governed) {
      throw invalid(
        "Default Owner, Manager, Sponsor, and Member roles require distinct Persons unless an explicit governed role-overlap scenario exists."
      );
    }
  }
}


function assertUnique(
  values: readonly string[],
  label: string
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw invalid(`Duplicate ${label}: ${value}.`);
    }
    seen.add(value);
  }
}


function record(
  value: unknown,
  path: string
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw invalid(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}


function knownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw invalid(`Unknown ${path} field: ${key}.`);
    }
  }
}


function nonBlankString(
  value: unknown,
  path: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(`${path} must be a nonblank string.`);
  }
  return value.trim();
}


function nullableString(
  value: unknown,
  path: string
): string | null {
  if (value === null) {
    return null;
  }
  return nonBlankString(value, path);
}


function uuid(
  value: unknown,
  path: string
): string {
  const result = nonBlankString(value, path);
  if (!UUID_PATTERN.test(result)) {
    throw invalid(`${path} must be a valid UUID.`);
  }
  return result;
}


function timestamp(
  value: unknown,
  path: string
): string {
  const result = nonBlankString(value, path);
  const parsed = Date.parse(result);
  if (
    !ISO_TIMESTAMP_PATTERN.test(result) ||
    !Number.isFinite(parsed)
  ) {
    throw invalid(
      `${path} must be an ISO-8601 timestamp with timezone.`
    );
  }
  return new Date(parsed).toISOString();
}


function nullableDate(
  value: unknown,
  path: string
): string | null {
  if (value === null) {
    return null;
  }
  const result = nonBlankString(value, path);
  const parsed = Date.parse(result);
  if (
    !DATE_PATTERN.test(result) ||
    !Number.isFinite(parsed)
  ) {
    throw invalid(`${path} must be a valid YYYY-MM-DD date.`);
  }
  return result;
}


function invalid(
  message: string
): PilotManifestValidationError {
  return new PilotManifestValidationError(message);
}


function rejectCredentialFields(
  value: unknown,
  path: string
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        rejectCredentialFields(item, `${path}[${index}]`)
    );
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (
      /(password|secret|token|bearer|credential|private.?key|api.?key)/i.test(
        key
      )
    ) {
      throw invalid(
        `Credential or secret field is forbidden: ${path}.${key}.`
      );
    }
    rejectCredentialFields(child, `${path}.${key}`);
  }
}


function canonicalize(
  value: unknown,
  path: readonly string[]
): unknown {
  if (Array.isArray(value)) {
    const canonicalItems = value.map(
      (item) => canonicalize(item, path)
    );
    if (path.at(-1) === "users") {
      return canonicalItems.sort((left, right) =>
        String((left as Record<string, unknown>).key).localeCompare(
          String((right as Record<string, unknown>).key)
        )
      );
    }
    if (path.at(-1) === "governedRoleOverlapScenarios") {
      return canonicalItems.sort((left, right) =>
        String((left as Record<string, unknown>).id).localeCompare(
          String((right as Record<string, unknown>).id)
        )
      );
    }
    if (path.at(-1) === "roles") {
      return canonicalItems.sort((left, right) =>
        String(left).localeCompare(String(right))
      );
    }
    return canonicalItems;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const object = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [
        key,
        canonicalize(object[key], [...path, key]),
      ])
  );
}


function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    typeof value === "object" &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);
    for (const child of Object.values(
      value as Record<string, unknown>
    )) {
      deepFreeze(child);
    }
  }
  return value;
}
