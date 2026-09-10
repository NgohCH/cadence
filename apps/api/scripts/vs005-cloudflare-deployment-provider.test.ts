import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  buildCloudflareWorkerStatusInspectionRequest,
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
  inspectCloudflareAccountMembership,
  inspectCloudflareLegacyReadOnlyNonAuthoritative,
  withoutCloudflareInspectionCredential,
  type CloudflareReadOnlyProviderFacts,
  type CloudflareDeploymentProviderIo,
} from "./vs005-cloudflare-deployment-provider";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import type {
  Vs005CorrelatedProviderInspection,
  Vs005Observation,
  Vs005ProviderObservationSnapshot,
} from "./vs005-provider-observations";

interface RollbackProvider {
  rollback(providerVersionId: string): Promise<{
    deploymentId: string;
    activeProviderVersionId: string;
  }>;
}

function isRollbackProvider(value: object): value is RollbackProvider {
  return "rollback" in value
    && typeof value.rollback === "function";
}

const config = validateCadenceRuntimeConfig(JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
));

const observed = <T>(value: T): Vs005Observation<T> => ({
  state: "OBSERVED_VALUE",
  value,
});

const absent = <T>(): Vs005Observation<T> => ({ state: "OBSERVED_ABSENT" });

const readOnlyFacts: CloudflareReadOnlyProviderFacts = {
  accountId: observed("account-123"),
  workerName: observed("worker-ci"),
  workerExists: observed(true),
  workerConfigFingerprint: observed("config-fingerprint"),
  cronSchedules: observed(["0 * * * *"]),
  nonSecretBindingNames: observed(["ASSETS"]),
  secretNames: observed(["SUPABASE_SECRET_KEY"]),
  currentRelease: observed({
    version: "0.0.0-test",
    commitSha: "0123456789012345678901234567890123456789",
    buildId: "build-test",
  }),
  priorVersion: absent(),
  hostname: observed("worker.example.test"),
};

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
    inspectReadOnly: async () => { throw new Error("structured inspection not configured"); },
    inspectLegacyReadOnly: async () => readOnlyFacts,
    ...overrides,
  };
  return { io, calls, deleted };
}

function observationsOf(result: { observations: Vs005ProviderObservationSnapshot }) {
  assert.ok(result.observations);
  return result.observations;
}

async function inspectAccountFixture(input: {
  expectedAccountId: string;
  stdout?: string;
  exitCode?: number;
  error?: Error;
}): Promise<{ observation: Vs005Observation<string>; calls: readonly (readonly string[])[] }> {
  const calls: Array<readonly string[]> = [];
  const observation = await inspectCloudflareAccountMembership({
    expectedAccountId: input.expectedAccountId,
    runWrangler: async (args) => {
      calls.push(args);
      if (input.error) throw input.error;
      return {
        exitCode: input.exitCode ?? 0,
        stdout: input.stdout ?? "",
      };
    },
  });
  return { observation, calls };
}

test("account inspection selects the expected account from Wrangler 4.127.1 membership JSON", async () => {
  const fixture = JSON.stringify({
    loggedIn: true,
    authType: "OAuth Token",
    email: "operator@example.test",
    accounts: [{ id: "account-expected", name: "Operator Account" }],
    tokenPermissions: ["Workers Scripts:Read"],
    unrelatedSecret: "secret-looking-value-must-not-escape",
  });

  const result = await inspectAccountFixture({
    expectedAccountId: "account-expected",
    stdout: fixture,
  });

  assert.deepEqual(result.observation, observed("account-expected"));
  assert.deepEqual(result.calls, [["wrangler", "whoami", "--json"]]);
  assert.doesNotMatch(JSON.stringify(result.observation), /operator|OAuth|Workers Scripts|secret-looking/i);
});

test("Wrangler deploy and rollback children omit only the inspection credential", async () => {
  const parentEnvironment = {
    CLOUDFLARE_INSPECTION_API_TOKEN: "inspection-token-canary",
    CLOUDFLARE_API_TOKEN: "deployment-auth-canary",
    UNRELATED_SETTING: "preserved",
  };
  const captured: Array<NodeJS.ProcessEnv | undefined> = [];
  const fake = fakeProviderIo({
    environment: parentEnvironment,
    runWrangler: async (_args, childEnvironment) => {
      captured.push(childEnvironment);
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          deployment_id: "deployment-1",
          version_id: "version-1",
          active_provider_version_id: "version-1",
        }),
      };
    },
  });
  const provider = createCloudflareDeploymentProvider(fake.io);

  assert.deepEqual(withoutCloudflareInspectionCredential(parentEnvironment), {
    CLOUDFLARE_API_TOKEN: "deployment-auth-canary",
    UNRELATED_SETTING: "preserved",
  });
  await provider.deploy({
    config,
    generatedWranglerPath: "wrangler.generated.jsonc",
    childEnvironment: parentEnvironment,
  } as never);
  await provider.rollback("version-1");

  assert.equal(captured.length, 2);
  for (const childEnvironment of captured) {
    assert.equal(childEnvironment?.CLOUDFLARE_INSPECTION_API_TOKEN, undefined);
    assert.equal(childEnvironment?.CLOUDFLARE_API_TOKEN, "deployment-auth-canary");
    assert.equal(childEnvironment?.UNRELATED_SETTING, "preserved");
  }
});

test("account inspection deterministically selects the expected account from multiple memberships", async () => {
  const result = await inspectAccountFixture({
    expectedAccountId: "account-expected",
    stdout: JSON.stringify({
      accounts: [
        { id: "account-other", name: "Other" },
        { id: "account-expected", name: "Expected" },
        { id: "account-third", name: "Third" },
      ],
    }),
  });

  assert.deepEqual(result.observation, observed("account-expected"));
});

test("account inspection fails closed when the expected membership is absent", async () => {
  for (const accounts of [
    [{ id: "account-other" }],
    [],
  ]) {
    const result = await inspectAccountFixture({
      expectedAccountId: "account-expected",
      stdout: JSON.stringify({ accounts }),
    });
    assert.deepEqual(result.observation, {
      state: "UNAVAILABLE",
      code: "CLOUDFLARE_ACCOUNT_UNAVAILABLE",
    });
  }
});

test("account inspection rejects missing, malformed, and obsolete membership shapes", async () => {
  const invalidOutputs = [
    JSON.stringify({ loggedIn: true }),
    JSON.stringify({ accounts: "account-expected" }),
    JSON.stringify({ accounts: [{ name: "Missing ID" }] }),
    JSON.stringify({ account_id: "account-expected" }),
    "not-json secret-looking-value-must-not-escape",
  ];

  for (const stdout of invalidOutputs) {
    const result = await inspectAccountFixture({
      expectedAccountId: "account-expected",
      stdout,
    });
    assert.deepEqual(result.observation, {
      state: "UNAVAILABLE",
      code: "CLOUDFLARE_ACCOUNT_UNAVAILABLE",
    });
    assert.doesNotMatch(JSON.stringify(result.observation), /secret-looking/i);
  }
});

test("account inspection ignores invalid unrelated entries when the expected membership is valid", async () => {
  const result = await inspectAccountFixture({
    expectedAccountId: "account-expected",
    stdout: JSON.stringify({
      accounts: [
        null,
        { name: "Missing ID" },
        { id: "contains spaces" },
        { id: "account-expected" },
      ],
    }),
  });

  assert.deepEqual(result.observation, observed("account-expected"));
});

test("account inspection maps command and authentication failures to UNAVAILABLE", async () => {
  const failedCommand = await inspectAccountFixture({
    expectedAccountId: "account-expected",
    exitCode: 1,
    stdout: "authentication failed token=must-not-escape",
  });
  const rejectedCommand = await inspectAccountFixture({
    expectedAccountId: "account-expected",
    error: new Error("network failed token=must-not-escape"),
  });

  for (const result of [failedCommand, rejectedCommand]) {
    assert.deepEqual(result.observation, {
      state: "UNAVAILABLE",
      code: "CLOUDFLARE_AUTH_UNAVAILABLE",
    });
    assert.doesNotMatch(JSON.stringify(result.observation), /must-not-escape/);
  }
});

test("account inspection remains portable to a non-Beta canonical account", async () => {
  const result = await inspectAccountFixture({
    expectedAccountId: "future-owner-account",
    stdout: JSON.stringify({
      accounts: [{ id: "future-owner-account", name: "Future Owner" }],
    }),
  });

  assert.deepEqual(result.observation, observed("future-owner-account"));
});

test("Worker status inspection request binds the canonical account, Worker, and generated config", () => {
  const request = buildCloudflareWorkerStatusInspectionRequest({
    accountId: "account-expected",
    workerName: "worker-expected",
    generatedWranglerPath: "path with spaces/wrangler.generated.jsonc",
    generatedConfig: {
      account_id: "account-expected",
      name: "worker-expected",
    },
  });

  assert.deepEqual(request, {
    target: {
      accountId: "account-expected",
      workerName: "worker-expected",
      generatedWranglerPath: "path with spaces/wrangler.generated.jsonc",
    },
    argv: [
      "wrangler",
      "deployments",
      "status",
      "--config",
      "path with spaces/wrangler.generated.jsonc",
      "--name",
      "worker-expected",
      "--json",
    ],
  });
  assert.equal("workerExists" in request, false);
});

test("Worker status inspection request rejects missing or mismatched target bindings", () => {
  const canonical = {
    accountId: "account-expected",
    workerName: "worker-expected",
    generatedWranglerPath: "wrangler.generated.jsonc",
    generatedConfig: {
      account_id: "account-expected",
      name: "worker-expected",
    },
  };

  const invalidInputs = [
    { ...canonical, accountId: "" },
    { ...canonical, workerName: "" },
    { ...canonical, generatedWranglerPath: "" },
    {
      ...canonical,
      generatedConfig: { ...canonical.generatedConfig, account_id: "other-account" },
    },
    {
      ...canonical,
      generatedConfig: { ...canonical.generatedConfig, name: "other-worker" },
    },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildCloudflareWorkerStatusInspectionRequest(input),
      /CLOUDFLARE_INSPECTION_TARGET_UNAVAILABLE/,
    );
  }
});

test("Worker status inspection request is portable and allowlists safe target data", () => {
  const request = buildCloudflareWorkerStatusInspectionRequest({
    accountId: "future-owner-account",
    workerName: "future-worker",
    generatedWranglerPath: "future/wrangler.generated.jsonc",
    generatedConfig: {
      account_id: "future-owner-account",
      name: "future-worker",
      CLOUDFLARE_API_TOKEN: "token-must-not-escape",
      SUPABASE_SECRET_KEY: "secret-must-not-escape",
    } as { account_id: string; name: string },
  });
  const serialized = JSON.stringify(request);

  assert.deepEqual(request.argv, [
    "wrangler",
    "deployments",
    "status",
    "--config",
    "future/wrangler.generated.jsonc",
    "--name",
    "future-worker",
    "--json",
  ]);
  assert.doesNotMatch(serialized, /token-must-not-escape|secret-must-not-escape/);
  assert.equal(request.argv.includes("deploy"), false);
  assert.equal(request.argv.includes("delete"), false);
  assert.equal(request.argv.includes("rollback"), false);
  assert.equal(request.argv.includes("put"), false);
  assert.equal(request.argv.includes("--account"), false);
  assert.equal(request.argv.includes("--env"), false);
  assert.equal(request.argv.includes("--profile"), false);
});

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

test("inspection returns account and Worker identity", async () => {
  let requested: { accountId: string; workerName: string } | undefined;
  const fake = fakeProviderIo({
    inspectLegacyReadOnly: async (input) => {
      requested = input;
      return readOnlyFacts;
    },
  });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.deepEqual(requested, { accountId: "account-ci", workerName: "worker-ci" });
  assert.deepEqual(observations.accountId, readOnlyFacts.accountId);
  assert.deepEqual(observations.workerName, readOnlyFacts.workerName);
});

test("inspection distinguishes absent Worker", async () => {
  const fake = fakeProviderIo({
    inspectLegacyReadOnly: async () => ({
      ...readOnlyFacts,
      workerExists: absent(),
    }),
  });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.deepEqual(observations.workerExists, { state: "OBSERVED_ABSENT" });
});

test("inspection preserves absent Cron and secret states", async () => {
  const fake = fakeProviderIo({
    inspectLegacyReadOnly: async () => ({
      ...readOnlyFacts,
      cronSchedules: absent(),
      secretNames: absent(),
    }),
  });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.deepEqual(observations.cronSchedules, { state: "OBSERVED_ABSENT" });
  assert.deepEqual(observations.secretNames, { state: "OBSERVED_ABSENT" });
});

test("inspection returns release and fingerprint facts without raw output", async () => {
  const fake = fakeProviderIo();
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.deepEqual(observations.currentRelease, readOnlyFacts.currentRelease);
  assert.deepEqual(observations.workerConfigFingerprint, readOnlyFacts.workerConfigFingerprint);
  assert.equal("rawOutput" in result, false);
  assert.equal(JSON.stringify(result).includes("deployment-raw-output"), false);
});

test("inspection never returns secret values", async () => {
  const maliciousFacts = {
    ...readOnlyFacts,
    secretNames: observed(["SUPABASE_SECRET_KEY"]),
    secretValue: "server-secret-must-not-escape",
  } as CloudflareReadOnlyProviderFacts & { secretValue: string };
  const fake = fakeProviderIo({ inspectLegacyReadOnly: async () => maliciousFacts });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.equal(JSON.stringify(result).includes("server-secret-must-not-escape"), false);
  assert.deepEqual(observations.secretNames, observed(["SUPABASE_SECRET_KEY"]));
});

test("inspection has no deploy or rollback capability", async () => {
  const fake = fakeProviderIo();
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);

  assert.equal("deploy" in result, false);
  assert.equal("rollback" in result, false);
});

test("provider failure maps to UNAVAILABLE", async () => {
  const fake = fakeProviderIo({
    inspectLegacyReadOnly: async () => {
      throw new Error("provider failed token=do-not-copy");
    },
  });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.equal(observations.accountId.state, "UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("do-not-copy"), false);
});

test("malformed provider facts fail closed without propagating raw values", async () => {
  const fake = fakeProviderIo({
    inspectLegacyReadOnly: async () => ({
      ...readOnlyFacts,
      accountId: { state: "OBSERVED_VALUE", value: "token=must-not-escape" },
      cronSchedules: { state: "OBSERVED_VALUE", value: ["unexpected\noutput"] },
    } as unknown as CloudflareReadOnlyProviderFacts),
  });
  const result = await inspectCloudflareLegacyReadOnlyNonAuthoritative(fake.io, config);
  const observations = observationsOf(result);

  assert.equal(observations.accountId.state, "UNAVAILABLE");
  assert.equal(observations.cronSchedules.state, "UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("token=must-not-escape"), false);
  assert.equal(JSON.stringify(result).includes("unexpected"), false);
});

test("workflow facade exposes no target-detached legacy inspection", () => {
  const fake = fakeProviderIo({
    runWrangler: async () => ({
      exitCode: 0,
      stdout: JSON.stringify({ account_id: "account-123", worker_name: "cadence-beta" }),
    }),
  });
  const provider = createCloudflareDeploymentProvider(fake.io);
  assert.equal("inspectTarget" in provider, false);
  assert.equal(fake.calls.length, 0);
});

test("rollback targets one explicit provider version through argv and returns bounded identifiers", async () => {
  const fake = fakeProviderIo({
    runWrangler: async (args) => {
      assert.deepEqual(args, ["wrangler", "rollback", "version-previous", "--yes"]);
      return {
        exitCode: 0,
        stdout: "deployment_id=deployment-after-rollback version_id=version-previous raw=ignored",
      };
    },
  });
  const provider = createCloudflareDeploymentProvider(fake.io);
  assert.equal(isRollbackProvider(provider), true);
  if (!isRollbackProvider(provider)) return;

  const result = await provider.rollback("version-previous");
  assert.deepEqual(result, {
    deploymentId: "deployment-after-rollback",
    activeProviderVersionId: "version-previous",
  });
  assert.equal(fake.calls.some((call) => call.args.includes("server-secret")), false);
});

test("rollback failure returns no raw provider error text", async () => {
  const fake = fakeProviderIo({
    runWrangler: async () => {
      throw new Error("provider failed token=do-not-copy");
    },
  });
  const provider = createCloudflareDeploymentProvider(fake.io);
  assert.equal(isRollbackProvider(provider), true);
  if (!isRollbackProvider(provider)) return;

  await assert.rejects(() => provider.rollback("version-previous"), /CLOUDFLARE_ROLLBACK_FAILED/);
});

test("default inspectReadOnly uses injected structured REST without Wrangler whoami", async () => {
  let wranglerCalls = 0;
  const fetchUrls: string[] = [];
  const release = {
    version: "1.2.3",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-09T00:00:00Z",
  };
  const io = createDefaultCloudflareProviderIo({
    credentialProvider: { getCredential: async () => "inspection-token-canary" },
    fetchImpl: async (url) => {
      fetchUrls.push(String(url));
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/deployments")) return new Response(JSON.stringify({ success: true, result: [] }));
      if (path.endsWith("/settings")) return new Response(JSON.stringify({ success: true, result: { bindings: [] } }));
      if (path.endsWith("/schedules")) return new Response(JSON.stringify({ success: true, result: [] }));
      if (path.endsWith("/scripts/worker-ci/subdomain")) return new Response(JSON.stringify({ success: true, result: { enabled: false } }));
      return new Response(JSON.stringify({ success: true, result: { subdomain: "portable-team" } }));
    },
    runWrangler: async () => {
      wranglerCalls += 1;
      return { exitCode: 0, stdout: "wrangler-authority-canary" };
    },
    clock: () => new Date("2026-09-09T01:02:03Z"),
  });

  const result = await io.inspectReadOnly({
    config,
    release,
    generatedConfig: buildCloudflareDeployment({ config, release }).wrangler,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });

  assert.equal(result.correlation.providerOrigin, "api.cloudflare.com");
  assert.deepEqual(result.correlation.completedOperations, [
    "CURRENT_DEPLOYMENT",
    "WORKER_SETTINGS",
    "CRON_SCHEDULES",
    "WORKER_SUBDOMAIN",
    "ACCOUNT_SUBDOMAIN",
  ]);
  assert.equal(wranglerCalls, 0);
  assert.equal(fetchUrls.length, 5);
  assert.doesNotMatch(JSON.stringify(result), /inspection-token-canary|wrangler-authority-canary/);
});

test("correlated facade inspection preserves Wrangler deployment and rollback mutation methods", async () => {
  const release = {
    version: "1.2.3",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-09T00:00:00Z",
  };
  const structured: Vs005CorrelatedProviderInspection = {
    correlation: {
      accountId: "account-ci",
      workerName: "worker-ci",
      configFingerprint: fingerprintCadenceRuntimeConfig(config),
      providerOrigin: "api.cloudflare.com" as const,
      profile: "FIRST_DEPLOYMENT_READINESS" as const,
      completedOperations: ["CURRENT_DEPLOYMENT"] as const,
      observedAt: "2026-09-09T01:02:03.000Z",
    },
    observations: {
      ...readOnlyFacts,
      accountId: observed("account-ci"),
      workerName: observed("worker-ci"),
      currentDeployment: absent(),
      workersDevEnabled: absent(),
      accountWorkersDevSubdomain: absent(),
    },
  };
  const fake = fakeProviderIo({ inspectReadOnly: async () => structured });
  const provider = createCloudflareDeploymentProvider(fake.io);
  const result = await provider.inspectStructured({
    config,
    release,
    generatedConfig: buildCloudflareDeployment({ config, release }).wrangler,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });

  assert.deepEqual(result, structured);
  assert.equal(typeof provider.deploy, "function");
  assert.equal(typeof provider.rollback, "function");
});

test("correlated facade does not expose a provider-selected account", async () => {
  const release = {
    version: "1.2.3",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-09T00:00:00Z",
  };
  const fake = fakeProviderIo({
    inspectReadOnly: async () => ({
      correlation: {
        accountId: "account-ci",
        workerName: "worker-ci",
        configFingerprint: fingerprintCadenceRuntimeConfig(config),
        providerOrigin: "api.cloudflare.com",
        profile: "FIRST_DEPLOYMENT_READINESS",
        completedOperations: ["CURRENT_DEPLOYMENT"],
        observedAt: "2026-09-09T01:02:03.000Z",
      },
      observations: {
        ...readOnlyFacts,
        accountId: observed("provider-selected-account"),
        workerName: observed("worker-ci"),
        currentDeployment: absent(),
        workersDevEnabled: absent(),
        accountWorkersDevSubdomain: absent(),
      },
    }),
  });
  const result = await createCloudflareDeploymentProvider(fake.io).inspectStructured({
    config,
    release,
    generatedConfig: buildCloudflareDeployment({ config, release }).wrangler,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });

  assert.equal(result.observations.accountId.state, "UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(result), /provider-selected-account/);
});

test("deployment workflow provider facade exposes no legacy inspection authority", () => {
  const provider = createCloudflareDeploymentProvider(fakeProviderIo().io);
  assert.equal("inspect" in provider, false);
  assert.equal("inspectTarget" in provider, false);
  assert.equal(typeof provider.inspectStructured, "function");
  assert.equal(typeof provider.deploy, "function");
  assert.equal(typeof provider.rollback, "function");
});
