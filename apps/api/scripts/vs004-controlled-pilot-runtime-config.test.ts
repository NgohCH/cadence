import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  loadCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import { loadControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";

const SECRET = "secret-value-that-must-not-leak";
const PASSWORD = "local-password-that-must-not-leak";
const temporaryDirectories: string[] = [];

function localConfig(): CadenceRuntimeConfig {
  return {
    configVersion: 1,
    application: {
      name: "cadence",
      environment: "local",
      publicUrl: "http://cadence.example.invalid",
      apiBaseUrl: "http://127.0.0.1:3000",
      requestBodyLimitBytes: 1048576,
    },
    runtime: { provider: "node" },
    supabase: {
      url: "http://127.0.0.1:54321",
      projectRef: null,
      publishableKey: "sb_publishable_test",
      secretKeySecretRef: "SUPABASE_SECRET_KEY",
    },
    pilot: {
      projectId: "11111111-1111-4111-8111-111111111111",
      safeTargetMarker: "local-safe-marker",
    },
    worker: {
      schedule: "* * * * *",
      maxRounds: 10,
      maxDeliveryAttempts: 20,
      maxMembershipExpiryAttempts: 20,
      softDeadlineSeconds: 20,
    },
    retry: { delaysSeconds: [60, 300, 900, 3600] },
  };
}

function localEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const directory = mkdtempSync(resolve(tmpdir(), "cadence-vs004-config-"));
  temporaryDirectories.push(directory);
  const path = resolve(directory, "runtime.json");
  writeFileSync(path, JSON.stringify(localConfig()), "utf8");
  return {
    CADENCE_CONFIG_PATH: path,
    SUPABASE_SECRET_KEY: SECRET,
    ...overrides,
  };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe("VS004 controlled pilot runtime configuration", () => {
  it("loads non-secret runtime values only from canonical configuration", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      localEnvironment({ CADENCE_LOCAL_DEV_PASSWORD: PASSWORD }),
    );

    assert.equal(configuration.runtimeTarget.cadenceEnv, "local");
    assert.equal(configuration.runtimeTarget.supabaseUrl, "http://127.0.0.1:54321");
    assert.equal(configuration.runtimeTarget.supabaseProjectRef, null);
    assert.equal(configuration.runtimeTarget.safeTargetMarker, "local-safe-marker");
    assert.equal(
      configuration.runtimeTarget.projectId,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(configuration.supabaseSecretKey, SECRET);
    assert.equal(configuration.firstAccountPassword, PASSWORD);
  });

  it("requires the configured secret reference and never falls back to other environment values", () => {
    const environment = localEnvironment({ SUPABASE_PUBLISHABLE_KEY: "publishable" });
    delete environment.SUPABASE_SECRET_KEY;
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(environment),
      /Configured secret SUPABASE_SECRET_KEY is required/,
    );
  });

  it("preserves local null project-ref normalization and immutable output", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(localEnvironment());
    assert.equal(configuration.runtimeTarget.supabaseProjectRef, null);
    assert.equal(Object.isFrozen(configuration), true);
    assert.equal(Object.isFrozen(configuration.runtimeTarget), true);
  });

  it("does not expose credentials in the runtime target", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      localEnvironment({ CADENCE_LOCAL_DEV_PASSWORD: PASSWORD }),
    );
    assert.equal("supabaseSecretKey" in configuration.runtimeTarget, false);
    assert.equal("firstAccountPassword" in configuration.runtimeTarget, false);
    assert.equal(JSON.stringify(configuration.runtimeTarget).includes(SECRET), false);
    assert.equal(JSON.stringify(configuration.runtimeTarget).includes(PASSWORD), false);
  });

  it("fails closed when the canonical config locator is missing", () => {
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration({ SUPABASE_SECRET_KEY: SECRET }),
      /Cadence config path is required/,
    );
  });
});
