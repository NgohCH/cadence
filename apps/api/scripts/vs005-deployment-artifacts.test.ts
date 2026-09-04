import assert from "node:assert/strict";
import test from "node:test";

import { makeVs005OperatorFailure } from "./vs005-deployment-artifacts";

test("operator failure records actionable safe context without a raw exception", () => {
  const failure = makeVs005OperatorFailure({
    stage: "apply",
    code: "CONFIG_FINGERPRINT_MISMATCH",
    mutationOccurred: false,
    existingService: "UNCHANGED",
    canonicalConfigPath: "config/cadence.runtime.beta.json",
    safeExpected: { configFingerprint: "expected" },
    safeObserved: { configFingerprint: "observed" },
    nextAction: "Run cadence:deploy:plan again with the reviewed canonical config.",
  });

  assert.equal(failure.artifactType, "cadence.vs005.operator-failure");
  assert.equal(failure.formatVersion, 1);
  assert.equal(failure.mutationOccurred, false);
  assert.equal(failure.existingService, "UNCHANGED");
  assert.doesNotMatch(JSON.stringify(failure), /server-secret|stack|password|token/i);
  assert.deepEqual(
    Object.keys(failure).filter((key) =>
      ["error", "cause", "stack", "messageBody"].includes(key),
    ),
    [],
  );
  assert.equal(Object.isFrozen(failure), true);
});
