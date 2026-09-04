export interface CadenceReleaseIdentity {
  version: string;
  commitSha: string;
  buildId: string;
}

export function loadCadenceReleaseIdentity(source: unknown): CadenceReleaseIdentity {
  if (!isRecord(source)) {
    throw new Error("Cadence release identity must be an object");
  }

  const version = safeIdentityValue(source.version, "version");
  const commitSha = safeIdentityValue(source.commitSha, "commit SHA").toLowerCase();
  const buildId = safeIdentityValue(source.buildId, "buildId");

  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error("Cadence release commit SHA must be a 40-hex Git SHA");
  }

  return { version, commitSha, buildId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeIdentityValue(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Cadence release ${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized || /[\u0000-\u001f\u007f\s]/.test(normalized)) {
    throw new Error(`Cadence release ${field} must be a nonblank safe identity`);
  }

  return normalized;
}
