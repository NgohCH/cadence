import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import type { Express } from "express";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
} from "../bootstrap/cadence-config";
import { createCadenceApp, type CadenceAppRuntime } from "./create-cadence-app";

const sourceConfig = loadCadenceRuntimeConfig(resolve(
  process.cwd(),
  "../../config/cadence.runtime.ci.json",
));
const runtime: CadenceAppRuntime = {
  config: {
    ...sourceConfig,
    application: { ...sourceConfig.application, requestBodyLimitBytes: 256 },
  },
  secrets: { supabaseSecretKey: "server-secret" },
  release: {
    version: "1.0.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-04T10:00:00Z",
  },
};

async function startTestApp(app: Express): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function requestHealth(app: Express): Promise<{ status: number; body: unknown }> {
  const { baseUrl, close } = await startTestApp(app);
  try {
    const response = await fetch(`${baseUrl}/health`);
    return { status: response.status, body: await response.json() };
  } finally {
    await close();
  }
}

const app = createCadenceApp(runtime);

test("health exposes safe release/config identity", async () => {
  const response = await requestHealth(app);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "cadence-api",
    environment: "beta",
    configVersion: 1,
    configFingerprint: fingerprintCadenceRuntimeConfig(runtime.config),
    version: "1.0.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-04T10:00:00Z",
  });
});

test("health does not expose server secrets or pilot project identity", async () => {
  const text = JSON.stringify((await requestHealth(app)).body);
  assert.doesNotMatch(text, /server-secret/);
  assert.doesNotMatch(text, /11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(text, /safeTargetMarker/);
  assert.doesNotMatch(text, /secretKeySecretRef/);
});

test("request body limit rejects oversized JSON before business routing", async () => {
  const { baseUrl, close } = await startTestApp(app);
  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/not-a-real-project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value: "x".repeat(runtime.config.application.requestBodyLimitBytes + 1),
      }),
    });
    assert.equal(response.status, 413);
  } finally {
    await close();
  }
});
