import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { assertRuntimeConfig } from "./assert-runtime-config";

const ciConfigPath = resolve(
  process.cwd(),
  "../../config/cadence.runtime.ci.json",
);

test("accepts the expected environment from canonical config", () => {
  const result = assertRuntimeConfig({
    expectedEnvironment: "beta",
    configPath: ciConfigPath,
  });
  assert.equal(result.environment, "beta");
  assert.equal(result.supabaseProjectRef, "abc123");
});

test("rejects a command/environment mismatch", () => {
  assert.throws(
    () => assertRuntimeConfig({
      expectedEnvironment: "qa",
      configPath: ciConfigPath,
    }),
    /requires environment qa/,
  );
});
