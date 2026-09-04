import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  createCloudflareDeploymentProvider,
  type CloudflareDeploymentProviderIo,
} from "./vs005-cloudflare-deployment-provider";

const config = validateCadenceRuntimeConfig(JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
));

function fakeProviderIo(overrides: Partial<CloudflareDeploymentProviderIo> = {}) {
  const calls: Array<{ args: readonly string[]; content?: string; mode?: number }> = [];
  const deleted: string[] = [];
  const io: CloudflareDeploymentProviderIo = {
    createTemporarySecretFile: async (content, mode) => {
      calls.push({ args: [], content, mode });
      return "temporary-secret.json";
    },
    deleteFile: async (path) => {
      deleted.push(path);
    },
    runWrangler: async (args) => {
      calls.push({ args });
      return {
        exitCode: 0,
        stdout: JSON.stringify({ deployment_id: "deployment-1", version_id: "version-1" }),
      };
    },
    ...overrides,
  };
  return { io, calls, deleted };
}

test("bootstrap secret uses a protected temporary file and never enters argv", async () => {
  const fake = fakeProviderIo();
  const provider = createCloudflareDeploymentProvider(fake.io);
  const result = await provider.deploy({
    config,
    generatedWranglerPath: "wrangler.generated.jsonc",
    bootstrapSecrets: { supabaseSecretKey: "server-secret" },
  });

  assert.deepEqual(fake.calls.find((call) => call.content)?.content, JSON.stringify({
    [config.supabase.secretKeySecretRef]: "server-secret",
  }));
  assert.equal(fake.calls.find((call) => call.content)?.mode, 0o600);
  assert.deepEqual(fake.calls.find((call) => call.args.length > 0)?.args, [
    "wrangler",
    "deploy",
    "--config",
    "wrangler.generated.jsonc",
    "--secrets-file",
    "temporary-secret.json",
  ]);
  assert.ok(fake.deleted.includes("temporary-secret.json"));
  assert.deepEqual(result, {
    deploymentId: "deployment-1",
    providerVersionId: "version-1",
  });
  assert.doesNotMatch(JSON.stringify(fake.calls.find((call) => call.args.length > 0)?.args), /server-secret/);
});

test("temporary secret is cleaned up when provider deployment fails", async () => {
  const fake = fakeProviderIo({
    runWrangler: async () => {
      throw new Error("provider failed token=do-not-copy");
    },
  });
  const provider = createCloudflareDeploymentProvider(fake.io);
  await assert.rejects(() => provider.deploy({
    config,
    generatedWranglerPath: "wrangler.generated.jsonc",
    bootstrapSecrets: { supabaseSecretKey: "server-secret" },
  }));
  assert.deepEqual(fake.deleted, ["temporary-secret.json"]);
  assert.doesNotMatch(JSON.stringify(fake.calls), /do-not-copy/);
});

test("existing remote secret deploy does not create a temporary secret file", async () => {
  const fake = fakeProviderIo();
  const provider = createCloudflareDeploymentProvider(fake.io);
  await provider.deploy({ config, generatedWranglerPath: "wrangler.generated.jsonc" });
  assert.equal(fake.calls.some((call) => call.content), false);
  assert.deepEqual(fake.calls.find((call) => call.args.length > 0)?.args, [
    "wrangler",
    "deploy",
    "--config",
    "wrangler.generated.jsonc",
  ]);
});

test("provider executes an argv array rather than a shell-concatenated command", async () => {
  const fake = fakeProviderIo();
  const provider = createCloudflareDeploymentProvider(fake.io);
  await provider.deploy({ config, generatedWranglerPath: "path with spaces.jsonc" });
  const args = fake.calls.find((call) => call.args.length > 0)?.args;
  assert.ok(Array.isArray(args));
  assert.equal(typeof args?.join(" "), "string");
});

test("provider returns bounded deployment identifiers", async () => {
  const fake = fakeProviderIo({
    runWrangler: async () => ({
      exitCode: 0,
      stdout: "deployment_id=deployment-2 version_id=version-2 raw=ignored",
    }),
  });
  const provider = createCloudflareDeploymentProvider(fake.io);
  const result = await provider.deploy({ config, generatedWranglerPath: "wrangler.generated.jsonc" });
  assert.deepEqual(result, {
    deploymentId: "deployment-2",
    providerVersionId: "version-2",
  });
});
