import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
} from "../src/bootstrap/cadence-target-policy";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";

export interface Vs005LocalReadinessInput {
  sourceCommit: string;
  t15aDesignSha256: string;
  frozenDesignSha256: string;
  frozenPlanSha256: string;
  configPath: string;
  config: CadenceRuntimeConfig;
  configFingerprint: string;
  release: CadenceReleaseIdentity;
  focusedTests: readonly { command: string; outcome: "PASS" }[];
}

export interface Vs005LocalReadinessArtifact {
  artifactType: "cadence.vs005.t15a-local-readiness";
  formatVersion: 1;
  sourceCommit: string;
  designSha256: string;
  frozenDesignSha256: string;
  frozenPlanSha256: string;
  intendedTarget: ReturnType<typeof getCadenceTargetFacts>;
  configPath: string;
  configFingerprint: string;
  release: CadenceReleaseIdentity;
  database: { migrationAction: "NONE" };
  destructiveActions: readonly [];
  focusedTests: readonly { command: string; outcome: "PASS" }[];
  betaConfigProvenance: "EARLY_NARROW_BOOTSTRAP_AUTHORIZATION_RECONCILED";
  task15RemoteMutation: "NOT_AUTHORIZED";
  pilotActivation: "NOT_AUTHORISED";
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;
const SENSITIVE_CONTENT_PATTERN = /SUPABASE_SECRET_KEY\s*[:=]\s*[^\s,}]+|SUPABASE_DB_PASSWORD|SERVICE_ROLE|CF_API_TOKEN|OAUTH_TOKEN|REFRESH_TOKEN|PRIVATE_KEY|server-secret|raw-provider|token=/i;

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertHash(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`INVALID_READINESS_HASH: ${field}`);
  }
}

function assertSafeCommit(value: unknown): asserts value is string {
  if (typeof value !== "string" || !COMMIT_PATTERN.test(value)) {
    throw new Error("INVALID_READINESS_SOURCE_COMMIT");
  }
}

function assertSafeConfigPath(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || SENSITIVE_CONTENT_PATTERN.test(value)) {
    throw new Error("INVALID_READINESS_CONFIG_PATH");
  }
}

function assertFocusedTests(
  value: unknown,
): asserts value is readonly { command: string; outcome: "PASS" }[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("READINESS_TEST_SUMMARY_REQUIRED");
  }
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("READINESS_TEST_SUMMARY_INVALID");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.command !== "string"
      || !record.command.trim()
      || record.outcome !== "PASS"
      || SENSITIVE_CONTENT_PATTERN.test(record.command)) {
      throw new Error("SENSITIVE_READINESS_CONTENT");
    }
  }
}

export function buildVs005LocalReadinessArtifact(
  input: Vs005LocalReadinessInput,
): Vs005LocalReadinessArtifact {
  assertSafeCommit(input.sourceCommit);
  assertHash(input.t15aDesignSha256, "t15aDesignSha256");
  assertHash(input.frozenDesignSha256, "frozenDesignSha256");
  assertHash(input.frozenPlanSha256, "frozenPlanSha256");
  assertSafeConfigPath(input.configPath);
  assertFocusedTests(input.focusedTests);

  const config = validateCadenceRuntimeConfig(input.config);
  const intendedTarget = getCadenceTargetFacts(config);
  try {
    assertCadenceTargetPolicy(config, VS005_BETA_TARGET_POLICY);
  } catch {
    throw new Error("READINESS_BETA_TARGET_POLICY_MISMATCH");
  }

  const expectedFingerprint = fingerprintCadenceRuntimeConfig(config);
  if (input.configFingerprint !== expectedFingerprint) {
    throw new Error("READINESS_CONFIG_FINGERPRINT_MISMATCH");
  }

  let release: CadenceReleaseIdentity;
  try {
    release = loadCadenceReleaseIdentity(input.release);
  } catch {
    throw new Error("INVALID_READINESS_RELEASE");
  }

  const artifact: Vs005LocalReadinessArtifact = {
    artifactType: "cadence.vs005.t15a-local-readiness",
    formatVersion: 1,
    sourceCommit: input.sourceCommit,
    designSha256: input.t15aDesignSha256,
    frozenDesignSha256: input.frozenDesignSha256,
    frozenPlanSha256: input.frozenPlanSha256,
    intendedTarget,
    configPath: input.configPath,
    configFingerprint: expectedFingerprint,
    release,
    database: { migrationAction: "NONE" },
    destructiveActions: [],
    focusedTests: input.focusedTests.map((item) => ({ command: item.command, outcome: "PASS" })),
    betaConfigProvenance: "EARLY_NARROW_BOOTSTRAP_AUTHORIZATION_RECONCILED",
    task15RemoteMutation: "NOT_AUTHORIZED",
    pilotActivation: "NOT_AUTHORISED",
  };

  if (SENSITIVE_CONTENT_PATTERN.test(JSON.stringify(artifact))) {
    throw new Error("SENSITIVE_READINESS_CONTENT");
  }
  if (!equalJson(release, input.release)) {
    throw new Error("INVALID_READINESS_RELEASE");
  }

  return Object.freeze({
    ...artifact,
    intendedTarget: Object.freeze({
      ...artifact.intendedTarget,
      cloudflare: Object.freeze({ ...artifact.intendedTarget.cloudflare }),
    }),
    database: Object.freeze({ ...artifact.database }),
    destructiveActions: Object.freeze([]) as readonly [],
    focusedTests: Object.freeze(artifact.focusedTests.map((item) => Object.freeze({ ...item }))),
  });
}

function requireArgument(args: readonly string[], name: string, index: number): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`INVALID_READINESS_ARGUMENTS: ${name}`);
  return value;
}

function parseCliArguments(args: readonly string[]): {
  configPath: string;
  sourceCommit: string;
  t15aDesignSha256: string;
  frozenDesignSha256: string;
  frozenPlanSha256: string;
  release: CadenceReleaseIdentity;
  tests: readonly { command: string; outcome: "PASS" }[];
  outputPath: string;
} {
  let configPath: string | undefined;
  let sourceCommit: string | undefined;
  let t15aDesignSha256: string | undefined;
  let frozenDesignSha256: string | undefined;
  let frozenPlanSha256: string | undefined;
  let releaseVersion: string | undefined;
  let releaseCommitSha: string | undefined;
  let releaseBuildId: string | undefined;
  let outputPath: string | undefined;
  const tests: Array<{ command: string; outcome: "PASS" }> = [];

  for (let index = 0; index < args.length; index += 1) {
    switch (args[index]) {
      case "--config": configPath = requireArgument(args, "config", index); index += 1; break;
      case "--source-commit": sourceCommit = requireArgument(args, "source-commit", index); index += 1; break;
      case "--t15a-design-sha256": t15aDesignSha256 = requireArgument(args, "t15a-design-sha256", index); index += 1; break;
      case "--frozen-design-sha256": frozenDesignSha256 = requireArgument(args, "frozen-design-sha256", index); index += 1; break;
      case "--frozen-plan-sha256": frozenPlanSha256 = requireArgument(args, "frozen-plan-sha256", index); index += 1; break;
      case "--release-version": releaseVersion = requireArgument(args, "release-version", index); index += 1; break;
      case "--release-commit-sha": releaseCommitSha = requireArgument(args, "release-commit-sha", index); index += 1; break;
      case "--release-build-id": releaseBuildId = requireArgument(args, "release-build-id", index); index += 1; break;
      case "--test": tests.push({ command: requireArgument(args, "test", index), outcome: "PASS" }); index += 1; break;
      case "--out": outputPath = requireArgument(args, "out", index); index += 1; break;
      default: throw new Error("INVALID_READINESS_ARGUMENTS");
    }
  }

  if (!configPath || !sourceCommit || !t15aDesignSha256 || !frozenDesignSha256 || !frozenPlanSha256
    || !releaseVersion || !releaseCommitSha || !releaseBuildId || !outputPath || tests.length === 0) {
    throw new Error("INVALID_READINESS_ARGUMENTS");
  }
  return {
    configPath,
    sourceCommit,
    t15aDesignSha256,
    frozenDesignSha256,
    frozenPlanSha256,
    release: { version: releaseVersion, commitSha: releaseCommitSha, buildId: releaseBuildId },
    tests,
    outputPath,
  };
}

function assertIgnoredLocalOutput(path: string): string {
  const absolute = resolve(path);
  const parts = absolute.split(sep);
  if (isAbsolute(path) && !parts.includes(".cadence")) throw new Error("READINESS_OUTPUT_MUST_BE_LOCAL");
  if (!parts.includes(".cadence")) throw new Error("READINESS_OUTPUT_MUST_BE_LOCAL");
  return absolute;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function runVs005LocalReadinessCli(args: readonly string[]): void {
  const parsed = parseCliArguments(args);
  const config = loadCadenceRuntimeConfig(parsed.configPath);
  const outputPath = assertIgnoredLocalOutput(parsed.outputPath);
  const artifact = buildVs005LocalReadinessArtifact({
    sourceCommit: parsed.sourceCommit,
    t15aDesignSha256: parsed.t15aDesignSha256,
    frozenDesignSha256: parsed.frozenDesignSha256,
    frozenPlanSha256: parsed.frozenPlanSha256,
    configPath: parsed.configPath,
    config,
    configFingerprint: fingerprintCadenceRuntimeConfig(config),
    release: parsed.release,
    focusedTests: parsed.tests,
  });
  writeJson(outputPath, artifact);
}

if (require.main === module) {
  try {
    runVs005LocalReadinessCli(process.argv.slice(2));
  } catch {
    process.stderr.write("T15A_READINESS_BLOCKED\n");
    process.exitCode = 1;
  }
}
