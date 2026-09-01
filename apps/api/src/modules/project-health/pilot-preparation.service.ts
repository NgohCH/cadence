import type {
  PilotProjectHealthPreparationRepository,
} from "./pilot-preparation.repository";
import type {
  PilotProjectHealthPreparationContext,
  PilotProjectHealthPreparationEvidence,
  ProjectHealthPreparationErrorCategory,
  ProjectHealthPreparationErrorCode,
  PilotProjectHealthPreparationFailureEvidence,
  PilotProjectHealthPreparationIntent,
  PilotProjectHealthPreparationResult,
  PilotProjectHealthRecord,
} from "./pilot-preparation.types";


export {
  type PilotProjectHealthPreparationContext,
  type PilotProjectHealthPreparationIntent,
  type PilotProjectHealthPreparationResult,
} from "./pilot-preparation.types";


export class ProjectHealthPilotPreparationError extends Error {
  readonly category: ProjectHealthPreparationErrorCategory;
  readonly code: ProjectHealthPreparationErrorCode;
  evidence?: PilotProjectHealthPreparationFailureEvidence;

  constructor(
    category: ProjectHealthPreparationErrorCategory,
    code: ProjectHealthPreparationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectHealthPilotPreparationError";
    this.category = category;
    this.code = code;
  }
}


export class ProjectHealthPilotPreparationService {
  constructor(
    private readonly repository: PilotProjectHealthPreparationRepository,
  ) {}

  async preparePilotHealth(
    intent: PilotProjectHealthPreparationIntent,
    context: PilotProjectHealthPreparationContext,
  ): Promise<PilotProjectHealthPreparationResult> {
    try {
      validateInput(intent, context);
      const observed = await this.readHealth(intent.projectId);
      if (observed) {
        assertCompatible(intent, observed);
        return result(intent, context, observed, "REUSED");
      }

      await this.createHealth(intent);
      const verified = await this.readHealth(intent.projectId);
      if (!verified) {
        throw preparationError(
          "PROJECT_HEALTH",
          "POSTCONDITION_FAILED",
          "Created Project Health could not be verified.",
        );
      }
      assertCompatible(intent, verified, true);
      return result(intent, context, verified, "CREATED");
    } catch (error) {
      if (error instanceof ProjectHealthPilotPreparationError) {
        error.evidence = {
          manifestProjectKey: intent?.manifestProjectKey ?? "",
          operatorPersonId: context?.operatorPersonId ?? "",
          runCorrelationId: context?.runCorrelationId ?? "",
        };
        throw error;
      }
      throw preparationError(
        "PERSISTENCE",
        "READ_FAILED",
        "Project Health pilot preparation failed.",
      );
    }
  }

  private async readHealth(
    projectId: string,
  ): Promise<PilotProjectHealthRecord | null> {
    try {
      return await this.repository.findCurrentProjectHealth(projectId);
    } catch {
      throw preparationError(
        "PERSISTENCE",
        "READ_FAILED",
        "Project Health state could not be read.",
      );
    }
  }

  private async createHealth(
    health: PilotProjectHealthPreparationIntent,
  ): Promise<void> {
    try {
      await this.repository.createCurrentProjectHealth({
        projectId: health.projectId,
        healthStatus: health.healthStatus,
        reasons: health.reasons,
        source: health.source,
        changedBy: health.changedBy,
      });
    } catch {
      throw preparationError(
        "PERSISTENCE",
        "CREATE_FAILED",
        "Project Health could not be created.",
      );
    }
  }
}


function result(
  intent: PilotProjectHealthPreparationIntent,
  context: PilotProjectHealthPreparationContext,
  health: PilotProjectHealthRecord,
  status: "CREATED" | "REUSED",
): PilotProjectHealthPreparationResult {
  const evidence: PilotProjectHealthPreparationEvidence = {
    manifestProjectKey: intent.manifestProjectKey,
    projectId: health.projectId,
    projectHealthId: health.projectId,
    operatorPersonId: context.operatorPersonId,
    runCorrelationId: context.runCorrelationId,
    healthStatus: health.healthStatus,
  };
  return deepFreeze({
    resources: [
      {
        resource: "PROJECT_HEALTH",
        status,
        id: health.projectId,
      },
    ],
    evidence,
  });
}


function preparationError(
  category: ProjectHealthPreparationErrorCategory,
  code: ProjectHealthPreparationErrorCode,
  message: string,
): ProjectHealthPilotPreparationError {
  return new ProjectHealthPilotPreparationError(category, code, message);
}


function validateInput(
  intent: PilotProjectHealthPreparationIntent,
  context: PilotProjectHealthPreparationContext,
): void {
  if (!isRecord(intent) || !isRecord(context)) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project Health preparation input is invalid.");
  }
  if (containsCredentialField(intent) || containsCredentialField(context)) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project Health preparation input contains a credential field.");
  }
  if (
    !nonEmptyString(intent.manifestProjectKey) ||
    !isUuid(intent.projectId) ||
    !nonEmptyString(context.operatorPersonId) ||
    !isUuid(context.operatorPersonId) ||
    !nonEmptyString(context.runCorrelationId) ||
    !Array.isArray(intent.reasons) ||
    !intent.reasons.every((reason) => nonEmptyString(reason)) ||
    !["on_track", "at_risk", "delayed", "blocked"].includes(intent.healthStatus) ||
    !["system", "manual", "agent"].includes(intent.source) ||
    (intent.source === "manual" && intent.changedBy === null) ||
    (intent.changedBy !== null && !isUuid(intent.changedBy))
  ) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project Health preparation input is invalid.");
  }
}


function assertCompatible(
  intent: PilotProjectHealthPreparationIntent,
  observed: PilotProjectHealthRecord,
  postcondition = false,
): void {
  if (
    observed.projectId !== intent.projectId ||
    observed.healthStatus !== intent.healthStatus ||
    !sameStringArray(observed.reasons, intent.reasons) ||
    observed.source !== intent.source ||
    observed.changedBy !== intent.changedBy
  ) {
    throw preparationError(
      "PROJECT_HEALTH",
      postcondition ? "POSTCONDITION_FAILED" : "CONFLICT",
      "Project Health conflicts with the intended current state.",
    );
  }
}


function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}


function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


function containsCredentialField(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const forbidden = new Set([
    "password",
    "secret",
    "token",
    "bearerToken",
    "serviceRoleKey",
    "providerSecret",
  ]);
  return Object.entries(value).some(([key, nested]) =>
    forbidden.has(key) || containsCredentialField(nested),
  );
}


function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
