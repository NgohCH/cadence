import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type {
  CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type {
  CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import {
  buildCloudflareDeployment,
} from "./vs005-generate-deployment";

const ciConfig: CadenceRuntimeConfig =
  validateCadenceRuntimeConfig({
    configVersion: 1,
    application: {
      name: "cadence",
      environment: "beta",
      publicUrl: "https://cadence-beta.example.test",
      apiBaseUrl: "",
      requestBodyLimitBytes: 1048576,
    },
    runtime: { provider: "cloudflare" },
    supabase: {
      url: "https://abc123.supabase.co",
      projectRef: "abc123",
      publishableKey: "sb_publishable_test",
      secretKeySecretRef: "SUPABASE_SECRET_KEY",
    },
    pilot: {
      projectId: "11111111-1111-4111-8111-111111111111",
      safeTargetMarker: "cadence-beta",
    },
    worker: {
      schedule: "* * * * *",
      maxRounds: 10,
      maxDeliveryAttempts: 20,
      maxMembershipExpiryAttempts: 20,
      softDeadlineSeconds: 20,
    },
    retry: { delaysSeconds: [60, 300, 900, 3600] },
  });

const release: CadenceReleaseIdentity = {
  version: "0.0.0-test",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T00:00:00Z",
};

test("generator derives one safe Cloudflare deployment from canonical config", () => {
  const result = buildCloudflareDeployment({
    config: ciConfig,
    release,
  });
  const embeddedConfig = JSON.parse(
    result.wrangler.vars.CADENCE_RUNTIME_CONFIG_JSON,
  );

  assert.equal(result.wrangler.name, "cadence-beta");
  assert.equal(result.wrangler.main, "src/index.ts");
  assert.equal(result.wrangler.compatibility_date, "2026-09-04");
  assert.deepEqual(result.wrangler.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(result.wrangler.assets, {
    directory: "../web/dist",
    binding: "ASSETS",
    run_worker_first: ["/api/*", "/health"],
    not_found_handling: "single-page-application",
  });
  assert.deepEqual(result.wrangler.triggers.crons, ["* * * * *"]);
  assert.deepEqual(result.wrangler.secrets.required, ["SUPABASE_SECRET_KEY"]);
  assert.deepEqual(embeddedConfig, ciConfig);
  assert.equal(
    result.wrangler.vars.CADENCE_CONFIG_FINGERPRINT,
    fingerprintCadenceRuntimeConfig(ciConfig),
  );
  assert.equal(
    result.wrangler.vars.CADENCE_RELEASE_VERSION,
    release.version,
  );
  assert.equal(result.wrangler.vars.CADENCE_COMMIT_SHA, release.commitSha);
  assert.equal(result.wrangler.vars.CADENCE_BUILD_ID, release.buildId);
  assert.doesNotMatch(
    JSON.stringify(result),
    /server-secret|SUPABASE_SECRET_KEY=/,
  );
});

test("generator does not bind Cloudflare data services", () => {
  const text = JSON.stringify(
    buildCloudflareDeployment({
      config: ciConfig,
      release,
    }),
  );

  assert.doesNotMatch(
    text,
    /durable_objects|d1_databases|kv_namespaces|queues/i,
  );
});

test("custom public origin becomes one declarative custom-domain route", () => {
  const result = buildCloudflareDeployment({
    config: ciConfig,
    release,
  });

  assert.equal(result.wrangler.workers_dev, false);
  assert.deepEqual(result.wrangler.routes, [
    {
      pattern: "cadence-beta.example.test",
      custom_domain: true,
    },
  ]);
});

test("workers.dev public origin uses the Workers development domain without a custom route", () => {
  const workersDevConfig: CadenceRuntimeConfig = {
    ...ciConfig,
    application: {
      ...ciConfig.application,
      publicUrl: "https://cadence-beta.example-account.workers.dev",
    },
  };
  const result = buildCloudflareDeployment({
    config: workersDevConfig,
    release,
  });

  assert.equal(result.wrangler.workers_dev, true);
  assert.equal(result.wrangler.routes, undefined);
});

test("non-Cloudflare runtime provider is rejected", () => {
  const nodeConfig: CadenceRuntimeConfig = {
    ...ciConfig,
    runtime: { provider: "node" },
  };

  assert.throws(
    () =>
      buildCloudflareDeployment({
        config: nodeConfig,
        release,
      }),
    /cloudflare/i,
  );
});
