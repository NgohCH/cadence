import assert from "node:assert/strict";
import test from "node:test";

import {
  validateCadenceEnvironmentSafety,
} from "./environment-safety";


test(
  "local accepts the standard local Supabase URL",
  () => {
    const result =
      validateCadenceEnvironmentSafety({
        cadenceEnv:
          "local",

        supabaseUrl:
          "http://127.0.0.1:54321",

        supabaseProjectRef:
          undefined,
      });

    assert.equal(
      result.cadenceEnv,
      "local"
    );

    assert.equal(
      result.supabaseProjectRef,
      null
    );
  }
);


test(
  "local also accepts localhost on the local Supabase port",
  () => {
    assert.doesNotThrow(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "local",

          supabaseUrl:
            "http://localhost:54321",

          supabaseProjectRef:
            undefined,
        })
    );
  }
);


test(
  "local rejects a hosted Supabase project",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "local",

          supabaseUrl:
            "https://exampleproject.supabase.co",

          supabaseProjectRef:
            undefined,
        }),

      /CADENCE_ENV=local requires SUPABASE_URL/
    );
  }
);


test(
  "local rejects a remote project ref",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "local",

          supabaseUrl:
            "http://127.0.0.1:54321",

          supabaseProjectRef:
            "exampleproject",
        }),

      /must not be set/
    );
  }
);


test(
  "qa accepts a matching hosted Supabase project",
  () => {
    const result =
      validateCadenceEnvironmentSafety({
        cadenceEnv:
          "qa",

        supabaseUrl:
          "https://exampleproject.supabase.co",

        supabaseProjectRef:
          "exampleproject",
      });

    assert.equal(
      result.cadenceEnv,
      "qa"
    );

    assert.equal(
      result.supabaseProjectRef,
      "exampleproject"
    );
  }
);


test(
  "beta accepts a matching hosted Supabase project",
  () => {
    const result =
      validateCadenceEnvironmentSafety({
        cadenceEnv:
          "beta",

        supabaseUrl:
          "https://betaproject.supabase.co",

        supabaseProjectRef:
          "betaproject",
      });

    assert.equal(
      result.cadenceEnv,
      "beta"
    );
  }
);


test(
  "hosted environments require a project ref",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "qa",

          supabaseUrl:
            "https://exampleproject.supabase.co",

          supabaseProjectRef:
            undefined,
        }),

      /CADENCE_SUPABASE_PROJECT_REF is required/
    );
  }
);


test(
  "hosted environments reject a mismatched project ref",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "qa",

          supabaseUrl:
            "https://actualproject.supabase.co",

          supabaseProjectRef:
            "differentproject",
        }),

      /requires SUPABASE_URL to match/
    );
  }
);


test(
  "hosted environments require HTTPS",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            "qa",

          supabaseUrl:
            "http://exampleproject.supabase.co",

          supabaseProjectRef:
            "exampleproject",
        }),

      /requires SUPABASE_URL to match/
    );
  }
);


test(
  "environment identity must be explicit",
  () => {
    assert.throws(
      () =>
        validateCadenceEnvironmentSafety({
          cadenceEnv:
            undefined,

          supabaseUrl:
            "http://127.0.0.1:54321",

          supabaseProjectRef:
            undefined,
        }),

      /CADENCE_ENV must be explicitly set/
    );
  }
);
