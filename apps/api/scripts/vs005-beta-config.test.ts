import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  VS005_BETA_TARGET_POLICY,
} from "../src/bootstrap/cadence-target-policy";

const configPath = resolve(process.cwd(), "../../config/cadence.runtime.beta.json");

function loadBetaConfig() {
  return loadCadenceRuntimeConfig(configPath);
}

test("Beta config contains explicit reviewed Cloudflare account and Worker", () => {
  const config = loadBetaConfig();
  assert.deepEqual(config.cloudflare, {
    accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
    workerName: "mycadence",
  });
});

test("Beta config passes generic validation", () => {
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  assert.doesNotThrow(() => validateCadenceRuntimeConfig(parsed));
});

test("Beta config passes exact Beta policy", () => {
  assert.doesNotThrow(() => assertCadenceTargetPolicy(loadBetaConfig(), VS005_BETA_TARGET_POLICY));
});

test("Beta config fingerprint is deterministic", () => {
  const first = loadBetaConfig();
  const second = loadBetaConfig();
  assert.equal(fingerprintCadenceRuntimeConfig(first), fingerprintCadenceRuntimeConfig(second));
});

test("Beta config has no privileged secret value", () => {
  const serialized = readFileSync(configPath, "utf8");
  assert.match(serialized, /"secretKeySecretRef"\s*:\s*"SUPABASE_SECRET_KEY"/);
  assert.doesNotMatch(serialized, /SUPABASE_DB_PASSWORD|SERVICE_ROLE|CF_API_TOKEN|OAUTH_TOKEN|REFRESH_TOKEN|PRIVATE_KEY/i);
  assert.doesNotMatch(serialized, /SUPABASE_SECRET_KEY\s*[:=]\s*"(?!SUPABASE_SECRET_KEY")/);
});

test("Beta config retains cadence-beta as marker rather than Worker identity", () => {
  const config = loadBetaConfig();
  assert.equal(config.pilot.safeTargetMarker, "cadence-beta");
  assert.equal(config.cloudflare?.workerName, "mycadence");
  assert.notEqual(config.pilot.safeTargetMarker, config.cloudflare?.workerName);
  assert.notEqual(config.application.environment, config.cloudflare?.workerName);
});
