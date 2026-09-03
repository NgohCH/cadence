import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  computeManifestHash,
  validatePilotManifest,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import type { PilotPreflightPlan } from "./vs004-preflight";
import type {
  PreparedPilotExecution,
} from "./vs004-controlled-pilot-preflight";
import type {
  PilotExecutionResult,
} from "./vs004-controlled-pilot-execution";
import {
  parsePreparedPilotExecutionArtifact,
  parsePilotExecutionFailureArtifact,
  parsePilotExecutionResultArtifact,
  serializePilotExecutionFailureArtifact,
  serializePilotExecutionResultArtifact,
  serializePreparedPilotExecutionArtifact,
  type PilotExecutionFailureEvidence,
} from "./vs004-controlled-pilot-artifact";


const runCorrelationId = "00449000-0000-4000-8000-000000000101";


function manifest(): ValidatedPilotManifest {
  return validatePilotManifest(
    JSON.parse(
      readFileSync(
        resolve(__dirname, "vs004-pilot.example.json"),
        "utf8",
      ),
    ),
  );
}


function prepared(): PreparedPilotExecution {
  const pilotManifest = manifest();
  const manifestHash = computeManifestHash(pilotManifest);
  const target = {
    environment: pilotManifest.target.environment,
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseProjectRef: null,
    projectId: pilotManifest.project.id,
    safeTargetMarker: pilotManifest.target.safeTargetMarker,
  } as const;
  const plan: PilotPreflightPlan = {
    manifestId: pilotManifest.manifestId,
    manifestHash,
    target: {
      environment: target.environment,
      projectId: target.projectId,
      safeTargetMarker: target.safeTargetMarker,
    },
    operatorPersonId: pilotManifest.operator.personId,
    runCorrelationId,
    operations: [],
  };
  return {
    manifestId: pilotManifest.manifestId,
    manifestHash,
    target,
    operatorPersonId: pilotManifest.operator.personId,
    runCorrelationId,
    validatedManifest: pilotManifest,
    observedEvidence: {
      observedAt: "2026-09-02T00:00:00.000Z",
      userCount: pilotManifest.users.length,
      personCount: 1,
      cadenceUserCount: 0,
      authenticationIdentityCount: 0,
      authAccountCount: 0,
      projectCount: 0,
      membershipCount: 0,
      roleAssignmentCount: 0,
      protectedTransferCount: 0,
    },
    preflightPlan: plan,
  };
}


function result(): PilotExecutionResult {
  const pilotPrepared = prepared();
  return {
    manifestId: pilotPrepared.manifestId,
    manifestHash: pilotPrepared.manifestHash,
    runCorrelationId,
    target: pilotPrepared.target,
    startedAt: "2026-09-02T01:00:00.000Z",
    completedAt: "2026-09-02T01:01:00.000Z",
    outcomes: [],
  };
}


function failure(
  overrides: Partial<PilotExecutionFailureEvidence> = {},
): PilotExecutionFailureEvidence {
  const pilotResult = result();
  return {
    manifestId: pilotResult.manifestId,
    manifestHash: pilotResult.manifestHash,
    runCorrelationId,
    target: pilotResult.target,
    category: "STALE_PLAN",
    completedOutcomes: [],
    executionCompleted: false,
    recordedAt: "2026-09-02T01:01:00.000Z",
    ...overrides,
  };
}


test("round-trips a valid PreparedPilotExecution envelope", () => {
  const original = prepared();
  const parsed = parsePreparedPilotExecutionArtifact(
    serializePreparedPilotExecutionArtifact(original),
  );

  assert.deepEqual(parsed, original);
});


test("preserves the exact inner prepared payload without regenerating authority", () => {
  const original = prepared();
  const before = JSON.stringify(original);
  const parsed = parsePreparedPilotExecutionArtifact(
    serializePreparedPilotExecutionArtifact(original),
  );

  assert.equal(JSON.stringify(parsed), before);
  assert.equal(parsed.runCorrelationId, original.runCorrelationId);
  assert.equal(parsed.manifestHash, original.manifestHash);
  assert.deepEqual(parsed.preflightPlan.operations, original.preflightPlan.operations);
});


test("rejects malformed prepared JSON", () => {
  assert.throws(
    () => parsePreparedPilotExecutionArtifact("{"),
    /JSON|artifact|invalid/i,
  );
});


test("rejects a wrong prepared artifact type", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  envelope.artifactType = "cadence.vs004.pilot-execution-result";

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /artifactType/i,
  );
});


test("rejects a missing prepared format version", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  delete envelope.formatVersion;

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /formatVersion/i,
  );
});


test("rejects an unsupported future prepared format version", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  envelope.formatVersion = 2;

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /formatVersion|unsupported/i,
  );
});


test("rejects malformed nested prepared target", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  envelope.preparedExecution.target.projectId = 42;

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /target|projectId/i,
  );
});


test("rejects malformed validated manifest", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  delete envelope.preparedExecution.validatedManifest.users;

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /manifest|users/i,
  );
});


test("rejects malformed preflight plan", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  delete envelope.preparedExecution.preflightPlan.operations;

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /plan|operations/i,
  );
});


test("rejects unsupported plan operation kinds", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  envelope.preparedExecution.preflightPlan.operations = [{
    kind: "DELETE",
    resourceKey: "project:forged",
  }];

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /operation|kind|unsupported/i,
  );
});


test("rejects unexpected credential-bearing prepared fields", () => {
  const envelope = JSON.parse(serializePreparedPilotExecutionArtifact(prepared()));
  envelope.preparedExecution.password = "not-for-artifacts";

  assert.throws(
    () => parsePreparedPilotExecutionArtifact(JSON.stringify(envelope)),
    /credential|password|secret/i,
  );
});


test("round-trips a valid PilotExecutionResult envelope", () => {
  const original = result();
  const parsed = parsePilotExecutionResultArtifact(
    serializePilotExecutionResultArtifact(original),
  );

  assert.deepEqual(parsed, original);
});


test("rejects wrong result artifact type and version", () => {
  const envelope = JSON.parse(serializePilotExecutionResultArtifact(result()));
  envelope.artifactType = "cadence.vs004.prepared-pilot-execution";
  assert.throws(
    () => parsePilotExecutionResultArtifact(JSON.stringify(envelope)),
    /artifactType/i,
  );

  envelope.artifactType = "cadence.vs004.pilot-execution-result";
  envelope.formatVersion = 99;
  assert.throws(
    () => parsePilotExecutionResultArtifact(JSON.stringify(envelope)),
    /formatVersion|unsupported/i,
  );
});


test("round-trips normal failure evidence", () => {
  const original = failure();
  const parsed = parsePilotExecutionFailureArtifact(
    serializePilotExecutionFailureArtifact(original),
  );

  assert.deepEqual(parsed, original);
});


test("rejects raw Error, stack, provider, and database failure objects", () => {
  const envelope = {
    artifactType: "cadence.vs004.pilot-execution-failure",
    formatVersion: 1,
    failure: {
      ...failure(),
      error: new Error("provider secret"),
      stack: "secret stack",
      providerResponse: { accessToken: "secret" },
      databaseResponse: { sql: "select secret" },
    },
  };

  assert.throws(
    () => parsePilotExecutionFailureArtifact(JSON.stringify(envelope)),
    /credential|error|stack|provider|database/i,
  );
  assert.throws(
    () => serializePilotExecutionFailureArtifact(
      envelope.failure as unknown as PilotExecutionFailureEvidence,
    ),
    /credential|error|stack|provider|database/i,
  );
});


test("preserves completed result in post-success-publication failure evidence", () => {
  const completedResult = result();
  const original = failure({
    category: "SUCCESS_ARTIFACT_PUBLICATION",
    executionCompleted: true,
    completedResult,
  });
  const parsed = parsePilotExecutionFailureArtifact(
    serializePilotExecutionFailureArtifact(original),
  );

  assert.equal(parsed.executionCompleted, true);
  assert.deepEqual(parsed.completedResult, completedResult);
});
