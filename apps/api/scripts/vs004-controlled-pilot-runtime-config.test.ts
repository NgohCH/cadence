import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";


const SECRET = "secret-value-that-must-not-leak";
const PASSWORD = "local-password-that-must-not-leak";


function localEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    CADENCE_ENV: "local",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: SECRET,
    CADENCE_SAFE_TARGET_MARKER: "local-safe-marker",
    CADENCE_PILOT_PROJECT_ID: "pilot-project-id",
    ...overrides,
  };
}


function hostedEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    CADENCE_ENV: "qa",
    SUPABASE_URL: "https://pilotref.supabase.co",
    CADENCE_SUPABASE_PROJECT_REF: "pilotref",
    SUPABASE_SECRET_KEY: SECRET,
    CADENCE_SAFE_TARGET_MARKER: "qa-safe-marker",
    CADENCE_PILOT_PROJECT_ID: "pilot-project-id",
    ...overrides,
  };
}


describe("VS004 controlled pilot runtime configuration", () => {
  it("loads all frozen runtime values through the injected environment", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      localEnvironment({ CADENCE_LOCAL_DEV_PASSWORD: PASSWORD }),
    );

    assert.equal(configuration.runtimeTarget.cadenceEnv, "local");
    assert.equal(configuration.runtimeTarget.supabaseUrl, "http://127.0.0.1:54321");
    assert.equal(configuration.runtimeTarget.supabaseProjectRef, null);
    assert.equal(configuration.runtimeTarget.safeTargetMarker, "local-safe-marker");
    assert.equal(configuration.runtimeTarget.projectId, "pilot-project-id");
    assert.equal(configuration.supabaseSecretKey, SECRET);
    assert.equal(configuration.firstAccountPassword, PASSWORD);
  });

  it("loads the pilot Project ID independently from Supabase target metadata", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      hostedEnvironment({
        CADENCE_SUPABASE_PROJECT_REF: "supabaseref",
        CADENCE_PILOT_PROJECT_ID: "cadence-project-id",
        CADENCE_SAFE_TARGET_MARKER: "operator-marker",
        SUPABASE_URL: "https://supabaseref.supabase.co",
      }),
    );

    assert.equal(configuration.runtimeTarget.projectId, "cadence-project-id");
    assert.equal(configuration.runtimeTarget.supabaseProjectRef, "supabaseref");
    assert.equal(configuration.runtimeTarget.safeTargetMarker, "operator-marker");
  });

  it("rejects each missing required local configuration value", () => {
    for (const name of [
      "CADENCE_ENV",
      "SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "CADENCE_SAFE_TARGET_MARKER",
      "CADENCE_PILOT_PROJECT_ID",
    ]) {
      const environment = localEnvironment();
      delete environment[name];
      assert.throws(
        () => loadControlledPilotRuntimeConfiguration(environment),
        new RegExp(name),
      );
    }
  });

  it("rejects blank required values", () => {
    for (const name of [
      "CADENCE_ENV",
      "SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "CADENCE_SAFE_TARGET_MARKER",
      "CADENCE_PILOT_PROJECT_ID",
    ]) {
      assert.throws(
        () => loadControlledPilotRuntimeConfiguration(localEnvironment({ [name]: "   " })),
        new RegExp(name),
      );
    }
  });

  it("requires the hosted project reference through the canonical safety validator", () => {
    const environment = hostedEnvironment();
    delete environment.CADENCE_SUPABASE_PROJECT_REF;
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(environment),
      /CADENCE_SUPABASE_PROJECT_REF/,
    );
  });

  it("preserves canonical malformed-environment rejection", () => {
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(localEnvironment({ SUPABASE_URL: "not-a-url" })),
      /SUPABASE_URL/,
    );
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(hostedEnvironment({ SUPABASE_URL: "http://pilotref.supabase.co" })),
      /SUPABASE_URL|match|HTTPS/i,
    );
    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(localEnvironment({ CADENCE_ENV: "production" })),
      /CADENCE_ENV/,
    );
  });

  it("does not use a publishable key as a secret-key fallback", () => {
    const environment = localEnvironment({ SUPABASE_PUBLISHABLE_KEY: "publishable" });
    delete environment.SUPABASE_SECRET_KEY;

    assert.throws(
      () => loadControlledPilotRuntimeConfiguration(environment),
      /SUPABASE_SECRET_KEY/,
    );
  });

  it("keeps credentials out of the credential-free runtime target", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      localEnvironment({ CADENCE_LOCAL_DEV_PASSWORD: PASSWORD }),
    );

    assert.equal("supabaseSecretKey" in configuration.runtimeTarget, false);
    assert.equal("firstAccountPassword" in configuration.runtimeTarget, false);
    assert.equal(JSON.stringify(configuration.runtimeTarget).includes(SECRET), false);
    assert.equal(JSON.stringify(configuration.runtimeTarget).includes(PASSWORD), false);
  });

  it("does not expose sentinel credentials in configuration errors", () => {
    const environment = localEnvironment({
      SUPABASE_SECRET_KEY: SECRET,
      CADENCE_LOCAL_DEV_PASSWORD: PASSWORD,
      CADENCE_SAFE_TARGET_MARKER: "   ",
    });

    assert.throws(() => loadControlledPilotRuntimeConfiguration(environment), (error: unknown) => {
      assert.equal(error instanceof Error, true);
      const message = error instanceof Error ? error.message : String(error);
      assert.equal(message.includes(SECRET), false);
      assert.equal(message.includes(PASSWORD), false);
      return true;
    });
  });

  it("treats the first-account password as optional protected runtime input", () => {
    const withoutPassword = loadControlledPilotRuntimeConfiguration(localEnvironment());
    const withBlankPassword = loadControlledPilotRuntimeConfiguration(
      localEnvironment({ CADENCE_LOCAL_DEV_PASSWORD: "   " }),
    );

    assert.equal(withoutPassword.firstAccountPassword, undefined);
    assert.equal(withBlankPassword.firstAccountPassword, undefined);
  });

  it("returns immutable configuration and target objects", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(localEnvironment());

    assert.equal(Object.isFrozen(configuration), true);
    assert.equal(Object.isFrozen(configuration.runtimeTarget), true);
  });

  it("does not derive target identity from a manifest or database state", () => {
    const configuration = loadControlledPilotRuntimeConfiguration(
      localEnvironment({
        CADENCE_PILOT_PROJECT_ID: "independent-runtime-project",
        CADENCE_SAFE_TARGET_MARKER: "independent-runtime-marker",
      }),
    );

    assert.equal(configuration.runtimeTarget.projectId, "independent-runtime-project");
    assert.equal(configuration.runtimeTarget.safeTargetMarker, "independent-runtime-marker");
  });
});
