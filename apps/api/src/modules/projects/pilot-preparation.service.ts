import type {
  PilotProjectPreparationRepository,
} from "./pilot-preparation.repository";
import type {
  PilotProjectPreparationContext,
  PilotProjectPreparationEvidence,
  PilotProjectPreparationErrorCategory,
  PilotProjectPreparationErrorCode,
  PilotProjectPreparationFailureEvidence,
  PilotProjectPreparationIntent,
  PilotProjectPreparationResult,
  PilotProjectRecord,
} from "./pilot-preparation.types";


export {
  type PilotProjectPreparationContext,
  type PilotProjectPreparationIntent,
  type PilotProjectPreparationResult,
} from "./pilot-preparation.types";


export class ProjectsPilotPreparationError extends Error {
  readonly category: PilotProjectPreparationErrorCategory;
  readonly code: PilotProjectPreparationErrorCode;
  evidence?: PilotProjectPreparationFailureEvidence;

  constructor(
    category: PilotProjectPreparationErrorCategory,
    code: PilotProjectPreparationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectsPilotPreparationError";
    this.category = category;
    this.code = code;
  }
}


export class ProjectsPilotPreparationService {
  constructor(
    private readonly repository: PilotProjectPreparationRepository,
  ) {}

  async preparePilotProject(
    intent: PilotProjectPreparationIntent,
    context: PilotProjectPreparationContext,
  ): Promise<PilotProjectPreparationResult> {
    try {
      validateInput(intent, context);
      const resources: PilotProjectPreparationResult["resources"] extends readonly (infer T)[]
        ? T[]
        : never[] = [];

      let project = await this.readProject(intent.project.id);
      if (project) {
        assertProjectCompatible(intent, project);
        resources.push({
          resource: "PROJECT",
          status: "REUSED",
          id: project.id,
        });
      } else {
        await this.createProject(intent.project);
        project = await this.readProject(intent.project.id);
        if (!project) {
          throw preparationError(
            "PROJECT",
            "POSTCONDITION_FAILED",
            "Created Project could not be verified.",
          );
        }
        assertProjectCompatible(intent, project, true);
        resources.push({
          resource: "PROJECT",
          status: "CREATED",
          id: project.id,
        });
      }

      const evidence: PilotProjectPreparationEvidence = {
        manifestProjectKey: intent.manifestProjectKey,
        projectId: project.id,
        operatorPersonId: context.operatorPersonId,
        runCorrelationId: context.runCorrelationId,
        lifecycleStatus: project.lifecycleStatus,
      };

      return deepFreeze({ resources, evidence });
    } catch (error) {
      if (error instanceof ProjectsPilotPreparationError) {
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
        "Projects pilot preparation failed.",
      );
    }
  }

  private async readProject(
    projectId: string,
  ): Promise<PilotProjectRecord | null> {
    try {
      return await this.repository.findProjectById(projectId);
    } catch {
      throw preparationError(
        "PERSISTENCE",
        "READ_FAILED",
        "Project state could not be read.",
      );
    }
  }

  private async createProject(
    project: PilotProjectPreparationIntent["project"],
  ): Promise<void> {
    try {
      await this.repository.createProject(project);
    } catch {
      throw preparationError(
        "PERSISTENCE",
        "CREATE_FAILED",
        "Project could not be created.",
      );
    }
  }
}


function preparationError(
  category: PilotProjectPreparationErrorCategory,
  code: PilotProjectPreparationErrorCode,
  message: string,
): ProjectsPilotPreparationError {
  return new ProjectsPilotPreparationError(category, code, message);
}


function validateInput(
  intent: PilotProjectPreparationIntent,
  context: PilotProjectPreparationContext,
): void {
  if (!isRecord(intent) || !isRecord(context)) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project preparation input is invalid.");
  }
  if (!isRecord(intent.project)) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project preparation input is incomplete.");
  }
  if (containsCredentialField(intent) || containsCredentialField(context)) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project preparation input contains a credential field.");
  }
  if (
    !nonEmptyString(intent.manifestProjectKey) ||
    !nonEmptyString(context.operatorPersonId) ||
    !nonEmptyString(context.runCorrelationId) ||
    !isUuid(intent.project.id) ||
    !nonEmptyString(intent.project.name) ||
    !isUuid(intent.project.ownerUserId) ||
    !isUuid(context.operatorPersonId) ||
    !isFiniteInteger(intent.project.progressPercent) ||
    intent.project.progressPercent < 0 ||
    intent.project.progressPercent > 100 ||
    !validDate(intent.project.startDate) ||
    !validDate(intent.project.targetDate) ||
    (intent.project.startDate !== null &&
      intent.project.targetDate !== null &&
      intent.project.startDate > intent.project.targetDate)
  ) {
    throw preparationError("INPUT", "INVALID_INPUT", "Project preparation input is invalid.");
  }
}


function assertProjectCompatible(
  intent: PilotProjectPreparationIntent,
  observed: PilotProjectRecord,
  postcondition = false,
): void {
  const code = postcondition ? "POSTCONDITION_FAILED" : "ATTRIBUTE_CONFLICT";
  if (observed.id !== intent.project.id) {
    throw preparationError("PROJECT", code, "Project identity conflicts with the intended project.");
  }
  if (observed.ownerUserId !== intent.project.ownerUserId) {
    throw preparationError(
      "PROJECT",
      postcondition ? "POSTCONDITION_FAILED" : "OWNER_PROJECTION_CONFLICT",
      "Project owner projection conflicts with the intended Owner Cadence User.",
    );
  }
  if (
    observed.name !== intent.project.name ||
    observed.description !== intent.project.description ||
    observed.goal !== intent.project.goal ||
    observed.lifecycleStatus !== intent.project.lifecycleStatus ||
    observed.progressPercent !== intent.project.progressPercent ||
    observed.startDate !== intent.project.startDate ||
    observed.targetDate !== intent.project.targetDate
  ) {
    throw preparationError("PROJECT", code, "Project attributes conflict with the intended project.");
  }
}


function validDate(value: string | null): boolean {
  return value === null ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)));
}


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}


function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
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
