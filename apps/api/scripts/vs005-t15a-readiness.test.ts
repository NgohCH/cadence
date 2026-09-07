import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  buildVs005LocalReadinessArtifact,
  type Vs005LocalReadinessInput,
} from "./vs005-t15a-readiness";

const config = loadCadenceRuntimeConfig("../../config/cadence.runtime.beta.json");
const input: Vs005LocalReadinessInput = {
  sourceCommit: "62f9077",
  t15aDesignSha256: "0ac81c0fbd0fe3490d3181a80961517a49dfa99bcf03bf91e11125d667c6ddb8",
  frozenDesignSha256: "5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8",
  frozenPlanSha256: "f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1",
  configPath: "config/cadence.runtime.beta.json",
  config,
  configFingerprint: fingerprintCadenceRuntimeConfig(config),
  release: {
    version: "0.0.0-t15a",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-07T00:00:00Z",
  },
  focusedTests: [
    { command: "node --import tsx --test scripts/vs005-beta-config.test.ts", outcome: "PASS" },
  ],
};

test("readiness records source and frozen hashes", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.equal(artifact.sourceCommit, input.sourceCommit);
  assert.equal(artifact.designSha256, input.t15aDesignSha256);
  assert.equal(artifact.frozenDesignSha256, input.frozenDesignSha256);
  assert.equal(artifact.frozenPlanSha256, input.frozenPlanSha256);
});

test("readiness records exact intended Beta tuple", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.deepEqual(artifact.intendedTarget, {
    environment: "beta",
    safeTargetMarker: "cadence-beta",
    cloudflare: {
      accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
      workerName: "mycadence",
    },
    publicUrl: "https://mycadence.ngohch-3d6.workers.dev",
    supabaseProjectRef: "pwmhasbmacmeerbsagda",
    pilotProjectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8",
  });
});

test("readiness records config fingerprint and release", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.equal(artifact.configFingerprint, input.configFingerprint);
  assert.deepEqual(artifact.release, input.release);
  assert.equal(artifact.configPath, input.configPath);
});

test("readiness declares database NONE and no destructive actions", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.deepEqual(artifact.database, { migrationAction: "NONE" });
  assert.deepEqual(artifact.destructiveActions, []);
});

test("readiness records Beta-config provenance", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.equal(artifact.betaConfigProvenance, "EARLY_NARROW_BOOTSTRAP_AUTHORIZATION_RECONCILED");
});

test("readiness records remote and Pilot Activation firewalls", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.equal(artifact.task15RemoteMutation, "NOT_AUTHORIZED");
  assert.equal(artifact.pilotActivation, "NOT_AUTHORISED");
});

test("readiness excludes secret values and raw provider output", () => {
  const artifact = buildVs005LocalReadinessArtifact(input);
  assert.doesNotMatch(JSON.stringify(artifact), /SUPABASE_SECRET_KEY=|server-secret|raw-provider|token=/i);
  assert.throws(
    () => buildVs005LocalReadinessArtifact({
      ...input,
      focusedTests: [{ command: "provider-output=server-secret", outcome: "PASS" }],
    }),
    /SENSITIVE_READINESS_CONTENT/,
  );
});
