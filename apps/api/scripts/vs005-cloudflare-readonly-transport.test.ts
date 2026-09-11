import assert from "node:assert/strict";
import test from "node:test";

import {
  createCloudflareReadOnlyTransport,
  createCloudflareWorkerInspectionTarget,
  createEnvironmentCloudflareCredentialProvider,
  type CloudflareReadOnlyTransportResult,
} from "./vs005-cloudflare-readonly-transport";
import { fingerprintCadenceRuntimeConfig } from "../src/bootstrap/cadence-config";

const accountId = "account-portable";
const workerName = "worker-name";

function config() {
  return {
    configVersion: 1,
    application: { name: "cadence", environment: "beta", publicUrl: "https://worker.example.test", apiBaseUrl: "", requestBodyLimitBytes: 1_048_576 },
    runtime: { provider: "cloudflare" },
    cloudflare: { accountId, workerName },
    supabase: { url: "https://project.supabase.co", projectRef: "project", publishableKey: "publishable", secretKeySecretRef: "SUPABASE_SECRET_KEY" },
    pilot: { projectId: "project", safeTargetMarker: "cadence-beta" },
    worker: { schedule: "* * * * *", maxRounds: 1, maxDeliveryAttempts: 1, maxMembershipExpiryAttempts: 1, softDeadlineSeconds: 1 },
    retry: { delaysSeconds: [1] },
  };
}

function target(overrides: Record<string, unknown> = {}) {
  const runtimeConfig = config();
  return createCloudflareWorkerInspectionTarget({
    config: runtimeConfig as never,
    generatedConfig: {
      wrangler: {
        account_id: accountId,
        name: workerName,
        vars: { CADENCE_CONFIG_FINGERPRINT: fingerprintCadenceRuntimeConfig(runtimeConfig as never) },
      },
    } as never,
    profile: "FIRST_DEPLOYMENT_READINESS",
    ...overrides,
  });
}

function response(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

test("environment credential provider exposes only the inspection token", async () => {
  await assert.rejects(
    createEnvironmentCloudflareCredentialProvider({}).getCredential(),
    /credential/i,
  );
  await assert.rejects(
    createEnvironmentCloudflareCredentialProvider({ CLOUDFLARE_INSPECTION_API_TOKEN: "  " }).getCredential(),
    /credential/i,
  );
  assert.equal(
    await createEnvironmentCloudflareCredentialProvider({
      CLOUDFLARE_INSPECTION_API_TOKEN: "token-canary",
      CLOUDFLARE_ACCOUNT_ID: "must-not-be-read",
    }).getCredential(),
    "token-canary",
  );
});

test("target construction requires canonical/generated account, Worker, and fingerprint correlation", () => {
  assert.deepEqual(target(), {
    accountId,
    workerName,
    publicHostname: "worker.example.test",
    configFingerprint: fingerprintCadenceRuntimeConfig(config() as never),
    generatedAccountId: accountId,
    generatedWorkerName: workerName,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });

  assert.throws(() => target({ generatedConfig: { wrangler: { account_id: "other", name: workerName, vars: {} } } }), /target|account/i);
  assert.throws(() => target({ generatedConfig: { wrangler: { account_id: accountId, name: "other", vars: {} } } }), /target|worker/i);
});

test("portable targets do not depend on the Beta tuple", () => {
  const portableConfig = { ...config(), cloudflare: { accountId: "other-account", workerName: "other-worker" } };
  const portable = createCloudflareWorkerInspectionTarget({
    config: portableConfig as never,
    generatedConfig: { wrangler: { account_id: "other-account", name: "other-worker", vars: { CADENCE_CONFIG_FINGERPRINT: fingerprintCadenceRuntimeConfig(portableConfig as never) } } } as never,
    profile: "ROLLBACK_READINESS",
  });
  assert.equal(portable.accountId, "other-account");
  assert.equal(portable.workerName, "other-worker");
});

test("all named routes use the fixed origin, encoded segments, GET, and manual redirects", async () => {
  const requests: Request[] = [];
  const transport = createCloudflareReadOnlyTransport({
    credentialProvider: { getCredential: async () => "token-canary" },
    fetchImpl: async (input, init) => {
      requests.push(new Request(input, init));
      return response({ success: true, result: {} });
    },
  });
  const inspectionTarget = target();
  const routes = [
    { operation: "CURRENT_DEPLOYMENT", target: inspectionTarget },
    { operation: "WORKER_SETTINGS", target: inspectionTarget },
    { operation: "CRON_SCHEDULES", target: inspectionTarget },
    { operation: "DEPLOYABLE_VERSIONS", target: inspectionTarget },
    { operation: "VERSION", target: inspectionTarget, versionId: "version/1" },
    { operation: "WORKER_SUBDOMAIN", target: inspectionTarget },
    { operation: "ACCOUNT_SUBDOMAIN", target: inspectionTarget },
  ] as const;

  for (const route of routes) {
    const result: CloudflareReadOnlyTransportResult = await transport.read(route);
    assert.notEqual(result.kind, "UNAVAILABLE");
  }

  assert.equal(requests.length, 7);
  for (const request of requests) {
    assert.equal(request.method, "GET");
    assert.equal(request.redirect, "manual");
    assert.match(request.url, /^https:\/\/api\.cloudflare\.com\/client\/v4\//);
    assert.match(request.url, /account-portable/);
    if (!request.url.endsWith("/workers/subdomain")) assert.match(request.url, /worker-name/);
    assert.equal(request.headers.get("authorization"), "Bearer token-canary");
    assert.equal(request.url.includes("token-canary"), false);
  }
  assert.match(requests[3].url, /versions\?deployable=true$/);
  assert.match(requests[4].url, /versions\/version%2F1$/);
});

test("target mismatch is rejected before credential access or fetch", async () => {
  let credentialReads = 0;
  let fetchCalls = 0;
  const transport = createCloudflareReadOnlyTransport({
    credentialProvider: { getCredential: async () => { credentialReads += 1; return "token"; } },
    fetchImpl: async () => { fetchCalls += 1; return response({ success: true, result: {} }); },
  });
  await assert.rejects(
    transport.read({
      operation: "CURRENT_DEPLOYMENT",
      target: { ...target(), generatedAccountId: "other" },
    }),
    /target|account/i,
  );
  assert.equal(credentialReads, 0);
  assert.equal(fetchCalls, 0);
});

test("transport classifies status, redirect, malformed, and network failures without raw material", async () => {
  const cases: Array<[string, () => Promise<Response>, string]> = [
    ["401", async () => response({ secret: "body-canary" }, 401), "AUTHENTICATION_FAILED"],
    ["403", async () => response({ message: "message-canary" }, 403), "AUTHORIZATION_FAILED"],
    ["404", async () => response({}, 404), "MALFORMED_RESPONSE"],
    ["429", async () => response({}, 429), "UNEXPECTED_PROVIDER_ERROR"],
    ["500", async () => response({}, 500), "UNEXPECTED_PROVIDER_ERROR"],
    ["redirect", async () => response("redirect-canary", 302), "UNEXPECTED_PROVIDER_ERROR"],
    ["malformed", async () => new Response("not-json", { status: 200 }), "MALFORMED_RESPONSE"],
    ["empty", async () => new Response("", { status: 200 }), "MALFORMED_RESPONSE"],
    ["network", async () => { throw new Error("exception-canary"); }, "NETWORK_UNAVAILABLE"],
    ["tls", async () => { throw Object.assign(new Error("tls-canary"), { code: "CERT_HAS_EXPIRED" }); }, "TLS_UNAVAILABLE"],
  ];
  for (const [name, fetchImpl, kind] of cases) {
    const transport = createCloudflareReadOnlyTransport({
      credentialProvider: { getCredential: async () => "token-canary" },
      fetchImpl,
    });
    const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target: target() });
    assert.equal(result.kind, "UNAVAILABLE", name);
    assert.equal(result.kind === "UNAVAILABLE" ? result.failure.kind : "", kind, name);
    assert.doesNotMatch(JSON.stringify(result), /token-canary|body-canary|message-canary|redirect-canary|exception-canary/);
  }
});

test("bounded 404 provider errors retain only numeric codes for the operation layer", async () => {
  for (const errorCodes of [[10007], [10090], [10007, 10090]]) {
    const transport = createCloudflareReadOnlyTransport({
      credentialProvider: { getCredential: async () => "token-canary" },
      fetchImpl: async () => response({
        success: false,
        errors: errorCodes.map((code) => ({ code, message: "message-canary", metadata: "metadata-canary" })),
        arbitrary: "body-canary",
      }, 404, { "x-canary": "header-canary" }),
    });
    const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target: target() });
    assert.deepEqual(result, {
      kind: "PROVIDER_FAILURE",
      operation: "CURRENT_DEPLOYMENT",
      errorCodes,
      errorsWellFormed: true,
    });
    assert.doesNotMatch(JSON.stringify(result), /token-canary|message-canary|metadata-canary|body-canary|header-canary/);
  }
});

test("malformed empty unknown and oversized 404 bodies never become Worker absence", async () => {
  const oversized = "x".repeat(1_048_577);
  const cases: Array<[string, () => Promise<Response>, "UNAVAILABLE" | "PROVIDER_FAILURE"]> = [
    ["malformed-json", async () => new Response("not-json", { status: 404 }), "UNAVAILABLE"],
    ["empty-body", async () => new Response("", { status: 404 }), "UNAVAILABLE"],
    ["malformed-errors", async () => response({ success: false, errors: "not-an-array" }, 404), "UNAVAILABLE"],
    ["empty-errors", async () => response({ success: false, errors: [] }, 404), "UNAVAILABLE"],
    ["oversized-errors", async () => response({ success: false, errors: Array.from({ length: 129 }, () => ({ code: 10007 })) }, 404), "UNAVAILABLE"],
    ["unknown-code", async () => response({ success: false, errors: [{ code: 99999 }] }, 404), "PROVIDER_FAILURE"],
    ["mixed-codes", async () => response({ success: false, errors: [{ code: 10007 }, { code: 99999 }] }, 404), "PROVIDER_FAILURE"],
    ["oversized-header", async () => new Response(oversized, { status: 404, headers: { "content-length": String(oversized.length) } }), "UNAVAILABLE"],
    ["oversized-stream", async () => new Response(oversized, { status: 404 }), "UNAVAILABLE"],
  ];
  for (const [name, fetchImpl, expectedKind] of cases) {
    const transport = createCloudflareReadOnlyTransport({
      credentialProvider: { getCredential: async () => "token-canary" },
      fetchImpl,
    });
    const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target: target() });
    assert.equal(result.kind, expectedKind, name);
    assert.doesNotMatch(JSON.stringify(result), /token-canary|not-json|not-an-array/);
  }
});

test("credential-provider failures become bounded authentication unavailability", async () => {
  const transport = createCloudflareReadOnlyTransport({
    credentialProvider: { getCredential: async () => { throw new Error("credential-canary"); } },
    fetchImpl: async () => { throw new Error("fetch-must-not-run"); },
  });
  const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target: target() });
  assert.deepEqual(result, {
    kind: "UNAVAILABLE",
    failure: { operation: "CURRENT_DEPLOYMENT", kind: "AUTHENTICATION_FAILED" },
  });
});

test("bounded body handling rejects oversized content and accepts exactly one MiB", async () => {
  const oversized = "x".repeat(1_048_577);
  const exactBodyBase = JSON.stringify({ success: true, result: {} });
  const exactBody = exactBodyBase + " ".repeat(1_048_576 - exactBodyBase.length);
  const calls: Array<() => Promise<Response>> = [
    async () => new Response(oversized, { status: 200, headers: { "content-length": String(oversized.length) } }),
    async () => new Response(oversized, { status: 200 }),
  ];
  for (const fetchImpl of calls) {
    const transport = createCloudflareReadOnlyTransport({
      credentialProvider: { getCredential: async () => "token" },
      fetchImpl,
    });
    const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target: target() });
    assert.equal(result.kind, "UNAVAILABLE");
  }
  const exactTransport = createCloudflareReadOnlyTransport({
    credentialProvider: { getCredential: async () => "token" },
    fetchImpl: async () => new Response(exactBody, { status: 200 }),
  });
  assert.equal(
    (await exactTransport.read({ operation: "CURRENT_DEPLOYMENT", target: target() })).kind,
    "SUCCESS",
  );
});
