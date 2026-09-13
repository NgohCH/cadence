import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
} from "../src/bootstrap/cadence-target-policy";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  applyVs005Deployment,
  isVs005CorrelatedDeploymentResult,
  type Vs005StructuredDeploymentProvider,
  type Vs005DeploymentResult,
} from "./vs005-deploy-apply";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import type { Vs005CorrelatedProviderInspection } from "./vs005-provider-observations";
import type { Vs005DeploymentPlanV2 } from "./vs005-deployment-artifacts";
import type {
  Vs005MutationEnvelope,
  Vs005Observation,
  Vs005ProviderObservationSnapshot,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

const repositoryRoot = resolve(process.cwd(), "../..");
const tsxLoader = pathToFileURL(resolve(repositoryRoot, "apps/api/node_modules/tsx/dist/loader.mjs")).href;
const applyCli = resolve(__dirname, "vs005-deploy-apply.ts");
const npmExecPath = process.env.npm_execpath
  ?? (process.platform === "win32"
    ? resolve(process.env.APPDATA ?? "", "npm/node_modules/npm/bin/npm-cli.js")
    : undefined);

test("apply CLI resolves every relative path from repository root across caller cwd", () => {
  const unrelated = mkdtempSync(resolve(tmpdir(), "cadence-apply-cwd-"));
  const original = process.cwd();
  try {
    for (const cwd of [repositoryRoot, resolve(repositoryRoot, "apps/api"), unrelated]) {
      const result = spawnSync(process.execPath, ["--import", tsxLoader, applyCli, "--plan", "missing-plan.json", "--config", "missing-config.json", "--out", ".cadence/vs005/space dir/../task3-apply-failure.json"], { cwd, encoding: "utf8", env: { ...process.env, INIT_CWD: unrelated, ...(npmExecPath ? { npm_execpath: npmExecPath } : {}) } });
      assert.equal(result.status, 0);
      assert.equal(existsSync(resolve(repositoryRoot, ".cadence/vs005/task3-apply-failure.json")), true);
      assert.equal(existsSync(resolve(cwd, ".cadence/vs005/task3-apply-failure.json")), cwd === repositoryRoot);
      rmSync(resolve(repositoryRoot, ".cadence/vs005/task3-apply-failure.json"), { force: true });
    }
  } finally {
    process.chdir(original);
    rmSync(unrelated, { recursive: true, force: true });
  }
});

test("apply CLI root-establishment failure performs no downstream reads or writes", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "cadence-apply-invalid-root-"));
  const apiRoot = resolve(fixture, "apps/api");
  const fixtureScripts = resolve(apiRoot, "scripts");
  mkdirSync(resolve(fixture, "apps/web"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/scripts"), fixtureScripts, { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/src"), resolve(apiRoot, "src"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/package.json"), resolve(apiRoot, "package.json"));
  mkdirSync(resolve(apiRoot, "node_modules"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/node_modules"), resolve(apiRoot, "node_modules"), { recursive: true });
  writeFileSync(resolve(fixture, "package.json"), JSON.stringify({ name: "not-cadence" }));
  writeFileSync(resolve(fixture, "apps/web/package.json"), JSON.stringify({ name: "web" }));
  const outputPath = resolve(fixture, ".cadence/root-failure.json");
  const reportPath = resolve(fixture, "probe.json");
  const probePath = resolve(fixture, "probe.cjs");
  writeFileSync(probePath, `const fs=require("node:fs");const cp=require("node:child_process");const out=${JSON.stringify(outputPath)};const report=${JSON.stringify(reportPath)};const c={inputReads:0,configReads:0,downstream:0,successWrites:0,failureWrites:0};const rr=fs.readFileSync.bind(fs);fs.readFileSync=(p,...a)=>{if(String(p).endsWith("input.json"))c.inputReads++;if(String(p).endsWith("config.json"))c.configReads++;return rr(p,...a)};const ww=fs.writeFileSync.bind(fs);fs.writeFileSync=(p,...a)=>{if(String(p)===out)c.failureWrites++;return ww(p,...a)};const ss=cp.spawn.bind(cp);cp.spawn=(...a)=>{c.downstream++;return ss(...a)};global.fetch=async()=>{c.downstream++;throw new Error("unexpected fetch")};process.on("exit",()=>ww(report,JSON.stringify(c)));`);
  const result = spawnSync(process.execPath, ["--require", probePath, "--import", tsxLoader, resolve(fixtureScripts, "vs005-deploy-apply.ts"), "--plan", "input.json", "--config", "config.json", "--out", outputPath], { cwd: fixture, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(resolve(fixture, ".cadence")), false);
  const probe = JSON.parse(require("node:fs").readFileSync(reportPath, "utf8")) as Record<string, number>;
  assert.deepEqual(probe, { inputReads: 0, configReads: 0, downstream: 0, successWrites: 0, failureWrites: 0 });
  rmSync(fixture, { recursive: true, force: true });
});

test("apply CLI preserves native absolute operator paths", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "cadence-apply-absolute-"));
  const outputPath = resolve(fixture, "space dir", "..", "apply-absolute.json");
  mkdirSync(resolve(fixture, "space dir"), { recursive: true });
  const result = spawnSync(process.execPath, ["--import", tsxLoader, applyCli, "--plan", resolve(fixture, "plan.json"), "--config", resolve(fixture, "config.json"), "--out", outputPath], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(existsSync(outputPath), true);
  rmSync(fixture, { recursive: true, force: true });
});

test("apply CLI runs web artifact preparation from apps/web", () => {
  const fixture = mkdtempSync(resolve(repositoryRoot, ".cadence-apply-web-cwd-"));
  const planPath = resolve(fixture, "plan.json");
  const configPath = resolve(fixture, "config.json");
  const outputPath = resolve(fixture, "deployment-result.json");
  const reportPath = resolve(fixture, "probe.json");
  const probePath = resolve(fixture, "probe.cjs");
  writeFileSync(planPath, JSON.stringify(validPlan()));
  writeFileSync(configPath, JSON.stringify(config));
  writeFileSync(probePath, `const fs=require("node:fs");const cp=require("node:child_process");const {EventEmitter}=require("node:events");const out=${JSON.stringify(reportPath)};const commands=[];const originalCwd=process.cwd();cp.spawn=(command,args,options)=>{if(args.includes("tsc")||args.includes("vite"))commands.push({command,args,cwd:options&&options.cwd||process.cwd()});const child=new EventEmitter();process.nextTick(()=>child.emit("close",0));return child};global.fetch=async()=>{throw new Error("stop-before-provider-mutation")};process.on("exit",()=>fs.writeFileSync(out,JSON.stringify({originalCwd,commands})));`);

  const result = spawnSync(process.execPath, [
    "--require",
    probePath,
    "--import",
    tsxLoader,
    applyCli,
    "--plan",
    planPath,
    "--config",
    configPath,
    "--out",
    outputPath,
  ], {
    cwd: resolve(repositoryRoot, "apps/api"),
    encoding: "utf8",
    env: {
      ...process.env,
      CADENCE_RELEASE_VERSION: release.version,
      CADENCE_COMMIT_SHA: release.commitSha,
      CADENCE_BUILD_ID: release.buildId,
      ...(npmExecPath ? { npm_execpath: npmExecPath } : {}),
    },
  });

  assert.equal(result.status, 0);
  const probe = JSON.parse(require("node:fs").readFileSync(reportPath, "utf8")) as {
    originalCwd: string;
    commands: Array<{ command: string; args: string[]; cwd: string }>;
  };
  assert.equal(probe.originalCwd, resolve(repositoryRoot, "apps/api"));
  assert.equal(probe.commands.length, 2);
  assert.deepEqual(probe.commands.map((command) => command.cwd), [
    resolve(repositoryRoot, "apps/web"),
    resolve(repositoryRoot, "apps/web"),
  ]);
  rmSync(fixture, { recursive: true, force: true });
});

test("apply CLI reports Windows npm.cmd spawn failure during real artifact preparation", {
  skip: process.platform !== "win32",
}, () => {
  const fixture = mkdtempSync(resolve(repositoryRoot, ".cadence-apply-npm-cmd-"));
  const planPath = resolve(fixture, "plan.json");
  const configPath = resolve(fixture, "config.json");
  const outputPath = resolve(fixture, "deployment-result.json");
  const probePath = resolve(fixture, "probe.cjs");
  try {
    assert.ok(npmExecPath);
    assert.equal(existsSync(npmExecPath), true);
    writeFileSync(planPath, JSON.stringify(validPlan()));
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(probePath, `const cp=require("node:child_process");const {EventEmitter}=require("node:events");const realSpawn=cp.spawn;cp.spawn=(command,args,options)=>{if(args.some((arg)=>String(arg).endsWith("wrangler.js"))){const child=new EventEmitter();process.nextTick(()=>child.emit("close",0));return child}return realSpawn(command,args,options)};global.fetch=async()=>({});`);

    const result = spawnSync(process.execPath, [
      "--require",
      probePath,
      "--import",
      tsxLoader,
      applyCli,
      "--plan",
      planPath,
      "--config",
      configPath,
      "--out",
      outputPath,
    ], {
      cwd: resolve(repositoryRoot, "apps/api"),
      encoding: "utf8",
      env: {
        ...process.env,
        CADENCE_RELEASE_VERSION: release.version,
        CADENCE_COMMIT_SHA: release.commitSha,
        CADENCE_BUILD_ID: release.buildId,
        npm_execpath: npmExecPath,
        CLOUDFLARE_INSPECTION_API_TOKEN: "test-only-inspection-token",
      },
    });

    assert.equal(result.status, 0);
    const failure = JSON.parse(require("node:fs").readFileSync(outputPath, "utf8")) as {
      artifactType: string;
      code: string;
      mutationOccurred: boolean;
    };
    assert.equal(failure.artifactType, "cadence.vs005.operator-failure");
    assert.equal(failure.code, "PROVIDER_INSPECTION_FAILED");
    assert.equal(failure.mutationOccurred, false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

const observed = <T>(value: T): Vs005Observation<T> => ({
  state: "OBSERVED_VALUE",
  value,
});
const absent = <T>(): Vs005Observation<T> => ({ state: "OBSERVED_ABSENT" });
const unavailable = <T>(code: string): Vs005Observation<T> => ({
  state: "UNAVAILABLE",
  code,
});

const config = validateCadenceRuntimeConfig({
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://mycadence.ngohch-3d6.workers.dev",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576,
  },
  runtime: { provider: "cloudflare" },
  cloudflare: {
    accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
    workerName: "mycadence",
  },
  supabase: {
    url: "https://pwmhasbmacmeerbsagda.supabase.co",
    projectRef: "pwmhasbmacmeerbsagda",
    publishableKey: "sb_publishable_beta",
    secretKeySecretRef: "SUPABASE_SECRET_KEY",
  },
  pilot: {
    projectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8",
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
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

function observations(
  currentConfig: CadenceRuntimeConfig = config,
  overrides: Partial<Vs005StructuredProviderObservationSnapshot> = {},
): Vs005StructuredProviderObservationSnapshot {
  return {
    accountId: observed(currentConfig.cloudflare!.accountId),
    workerName: observed(currentConfig.cloudflare!.workerName),
    workerExists: observed(true),
    workerConfigFingerprint: observed(fingerprintCadenceRuntimeConfig(currentConfig)),
    cronSchedules: observed([currentConfig.worker.schedule]),
    nonSecretBindingNames: observed(["ASSETS"]),
    secretNames: observed([currentConfig.supabase.secretKeySecretRef]),
    currentRelease: observed(release),
    priorVersion: absent(),
    hostname: observed(new URL(currentConfig.application.publicUrl).hostname),
    currentDeployment: observed({
      deploymentId: "deployment-current",
      versions: [{ providerVersionId: "version-current", percentage: 100 }],
    }),
    workersDevEnabled: observed(true),
    accountWorkersDevSubdomain: observed("ngohch-3d6"),
    ...overrides,
  };
}

const defaultEnvelope: Vs005MutationEnvelope = {
  workerAction: "CREATE_OR_UPDATE",
  cronAction: "NO_CHANGE",
  secretNamesToSet: [],
};

function validPlan(
  overrides: Partial<Vs005DeploymentPlanV2> = {},
): Vs005DeploymentPlanV2 {
  const providerObservations = overrides.observedProvider ?? observations();
  const workerAbsent = providerObservations.workerExists.state === "OBSERVED_ABSENT";
  const target = getCadenceTargetFacts(config);
  return {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 2,
    providerCorrelation: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      configFingerprint: fingerprintCadenceRuntimeConfig(config),
      providerOrigin: "api.cloudflare.com",
      profile: "FIRST_DEPLOYMENT_READINESS",
      completedOperations: workerAbsent
        ? ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]
        : [
            "CURRENT_DEPLOYMENT",
            "WORKER_SETTINGS",
            "CRON_SCHEDULES",
            "WORKER_SUBDOMAIN",
            "ACCOUNT_SUBDOMAIN",
          ],
      observedAt: "2026-09-10T00:00:00.000Z",
    },
    planId: "plan-1",
    intendedTarget: target,
    targetPolicy: { name: VS005_BETA_TARGET_POLICY.name },
    observedProvider: providerObservations,
    observationPhase: "FIRST_DEPLOYMENT_READINESS",
    mutationEnvelope: defaultEnvelope,
    configFingerprint: fingerprintCadenceRuntimeConfig(config),
    release,
    database: { migrationAction: "NONE" },
    destructiveActions: [],
    readiness: "PASS",
    blockers: [],
    environment: config.application.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      workerExists: true,
    },
    publicUrl: config.application.publicUrl,
    supabaseProjectRef: config.supabase.projectRef,
    configVersion: config.configVersion,
    worker: {
      schedule: config.worker.schedule,
      maxRounds: config.worker.maxRounds,
      maxDeliveryAttempts: config.worker.maxDeliveryAttempts,
      maxMembershipExpiryAttempts: config.worker.maxMembershipExpiryAttempts,
      softDeadlineSeconds: config.worker.softDeadlineSeconds,
    },
    secrets: [{
      name: config.supabase.secretKeySecretRef,
      providerPresent: true,
      bootstrapInputAvailable: false,
      ready: true,
    }],
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    changes: ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"],
    ...overrides,
  };
}

function makeProvider(
  providerObservations: Vs005StructuredProviderObservationSnapshot = observations(),
  correlationOverrides: Partial<Vs005CorrelatedProviderInspection["correlation"]> = {},
): Vs005StructuredDeploymentProvider & {
  inspectCalls: number;
  legacyCalls: number;
  deployCalls: Array<Record<string, unknown>>;
} {
  const provider = {
    inspectCalls: 0,
    legacyCalls: 0,
    deployCalls: [] as Array<Record<string, unknown>>,
    async inspectStructured() {
      provider.inspectCalls += 1;
      return {
        correlation: {
          ...validPlan().providerCorrelation,
          completedOperations: providerObservations.workerExists.state === "OBSERVED_ABSENT"
            ? ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"] as const
            : validPlan().providerCorrelation.completedOperations,
          ...correlationOverrides,
        },
        observations: providerObservations,
      };
    },
    async inspect() {
      provider.legacyCalls += 1;
      throw new Error("LEGACY_AUTHORITY_FORBIDDEN");
    },
    async deploy(input: Record<string, unknown>) {
      provider.deployCalls.push(input);
      return { deploymentId: "deployment-1", providerVersionId: "version-1" };
    },
  };
  return provider;
}

function makePreparation(order: string[], throws = false) {
  return async () => {
    order.push("prepare");
    if (throws) throw new Error("local artifact failure");
    return {
      generatedWranglerPath: "wrangler.generated.jsonc",
      generatedConfig: buildCloudflareDeployment({ config, release }).wrangler,
    };
  };
}

function apply(
  plan: unknown,
  overrides: Partial<Parameters<typeof applyVs005Deployment>[0]> = {},
) {
  return applyVs005Deployment({
    plan,
    config,
    targetPolicy: VS005_BETA_TARGET_POLICY,
    currentRelease: release,
    currentSecrets: { supabaseSecretKey: "server-secret" },
    provider: makeProvider(),
    prepareArtifacts: makePreparation([]),
    dryRun: async () => undefined,
    clock: () => new Date("2026-09-04T12:34:56.000Z"),
    ...overrides,
  });
}

test("exact reviewed state reaches the injected mutation boundary", async () => {
  const provider = makeProvider();
  const result = await apply(validPlan(), { provider });

  assert.equal(provider.deployCalls.length, 1);
  assert.deepEqual(result.intendedTarget, VS005_BETA_TARGET_POLICY.expected);
  assert.deepEqual(result.observedProvider, observations());
  assert.equal(result.databaseAction, "NONE");
  assert.deepEqual(result.destructiveActions, []);
  assert.doesNotMatch(JSON.stringify(result), /server-secret|password|token|stack/i);
});

test("legacy mutation plan is rejected before provider deployment", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), formatVersion: 1 }, { provider }),
    /plan|version|unsupported/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("v2 plan without correlation fails before preparation inspection or deployment", async () => {
  const provider = makeProvider();
  let preparationCalls = 0;
  await assert.rejects(
    () => apply({ ...validPlan(), providerCorrelation: undefined }, {
      provider,
      prepareArtifacts: async () => {
        preparationCalls += 1;
        return makePreparation([])();
      },
    }),
    /plan|invalid/i,
  );
  assert.equal(preparationCalls, 0);
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.legacyCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

for (const [field, changedPatch, expectedError] of [
  ["account", { cloudflare: { ...config.cloudflare!, accountId: "other-account" } }, /target|account/i],
  ["Worker", { cloudflare: { ...config.cloudflare!, workerName: "other-worker" } }, /target|worker/i],
  ["URL", { application: { ...config.application, publicUrl: "https://other.example.test" } }, /target|url/i],
  ["Supabase ref", {
    supabase: { ...config.supabase, projectRef: "otherref", url: "https://otherref.supabase.co" },
  }, /target|supabase/i],
  ["safe marker", { pilot: { ...config.pilot, safeTargetMarker: "other-marker" } }, /target|marker/i],
  ["controlled Project", {
    pilot: { ...config.pilot, projectId: "11111111-1111-4111-8111-111111111111" },
  }, /target|project/i],
] as const) {
  test(`apply rejects wrong ${field} before provider deployment`, async () => {
    const provider = makeProvider();
    const changedConfig = validateCadenceRuntimeConfig({ ...config, ...changedPatch });
    await assert.rejects(
      () => apply(validPlan(), { config: changedConfig, provider }),
      expectedError,
    );
    assert.equal(provider.inspectCalls, 0);
    assert.equal(provider.deployCalls.length, 0);
  });
}

test("apply rejects stale intended target", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan({
      intendedTarget: { ...getCadenceTargetFacts(config), safeTargetMarker: "stale-marker" },
    }), { provider }),
    /target|stale|marker/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects stale config fingerprint", async () => {
  const provider = makeProvider();
  const changedConfig = validateCadenceRuntimeConfig({
    ...config,
    worker: { ...config.worker, maxRounds: 11 },
  });
  await assert.rejects(
    () => apply(validPlan(), { config: changedConfig, provider }),
    /fingerprint|config/i,
  );
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects stale release", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan(), {
      provider,
      currentRelease: { ...release, commitSha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd" },
    }),
    /release/i,
  );
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects required unavailable observation", async () => {
  const provider = makeProvider(observations(config, {
    accountId: unavailable("ACCOUNT_UNAVAILABLE"),
  }));
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /observation|account|unavailable/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply accepts absent Worker only for first deployment envelope", async () => {
  const firstDeploymentObservations = observations(config, {
    workerExists: absent(),
    workerConfigFingerprint: absent(),
    nonSecretBindingNames: absent(),
    cronSchedules: absent(),
    secretNames: absent(),
    currentRelease: absent(),
    priorVersion: absent(),
    currentDeployment: absent(),
    workersDevEnabled: absent(),
    hostname: absent(),
  });
  const provider = makeProvider(firstDeploymentObservations);
  const result = await apply(validPlan({
    observedProvider: firstDeploymentObservations,
    providerTarget: { ...validPlan().providerTarget, workerExists: false },
    mutationEnvelope: {
      workerAction: "CREATE_OR_UPDATE",
      cronAction: "CREATE_OR_CHANGE",
      secretNamesToSet: ["SUPABASE_SECRET_KEY"],
    },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: false,
      bootstrapInputAvailable: true,
      ready: true,
    }],
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
  }), { provider });

  assert.equal(provider.deployCalls.length, 1);
  assert.deepEqual(provider.deployCalls[0]?.bootstrapSecrets, {
    supabaseSecretKey: "server-secret",
  });
  assert.doesNotMatch(JSON.stringify(result), /server-secret/);
});

test("apply rejects absent secret without planned setting", async () => {
  const providerObservations = observations(config, { secretNames: absent() });
  const provider = makeProvider(providerObservations);
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: providerObservations,
      mutationEnvelope: defaultEnvelope,
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: false,
      }],
    }), { provider }),
    /secret|envelope/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects unexpected secret-state change", async () => {
  const planObservations = observations(config, { secretNames: absent() });
  const provider = makeProvider(observations(config));
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: planObservations,
      mutationEnvelope: {
        workerAction: "CREATE_OR_UPDATE",
        cronAction: "NO_CHANGE",
        secretNamesToSet: ["SUPABASE_SECRET_KEY"],
      },
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: true,
      }],
    }), { provider }),
    /secret|drift/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects provider account and Worker drift", async () => {
  for (const changed of [
    observations(config, { accountId: observed("other-account") }),
    observations(config, { workerName: observed("other-worker") }),
    observations(config, { workerExists: absent() }),
  ]) {
    const provider = makeProvider(changed);
    await assert.rejects(() => apply(validPlan(), { provider }), /drift|provider|worker|account/i);
    assert.equal(provider.deployCalls.length, 0);
  }
});

test("fresh structured correlation drift blocks deployment", async () => {
  const cases: Array<Partial<Vs005CorrelatedProviderInspection["correlation"]>> = [
    { accountId: "other-account" },
    { workerName: "other-worker" },
    { configFingerprint: "b".repeat(64) },
    { providerOrigin: "other.example" as "api.cloudflare.com" },
    { profile: "POST_DEPLOYMENT_VERIFICATION" },
    { completedOperations: ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"] },
  ];
  for (const correlationOverride of cases) {
    const provider = makeProvider(observations(), correlationOverride);
    await assert.rejects(() => apply(validPlan(), { provider }), /drift|profile|operation|inspection/i);
    assert.equal(provider.deployCalls.length, 0);
    assert.equal(provider.legacyCalls, 0);
  }
});

test("apply rejects Cron precondition drift", async () => {
  const provider = makeProvider(observations(config, { cronSchedules: absent() }));
  await assert.rejects(() => apply(validPlan(), { provider }), /cron|drift|observation|unavailable/i);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects database action", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), database: { migrationAction: "NEW_MIGRATION" } } as unknown, { provider }),
    /database|migration/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects destructive action", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), destructiveActions: ["DELETE_TARGET"] } as unknown, { provider }),
    /destructive/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects missing approved Worker action without mutation", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan({
      mutationEnvelope: {
        workerAction: "NOT_ALLOWED",
        cronAction: "NO_CHANGE",
        secretNamesToSet: [],
      } as unknown as Vs005MutationEnvelope,
    }), { provider }),
    /envelope|worker/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects unavailable secret observation without mutation", async () => {
  const provider = makeProvider(observations(config, {
    secretNames: unavailable("SECRET_UNAVAILABLE"),
  }));
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /secret|observation|unavailable/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("artifact preparation failure prevents provider deployment", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan(), {
      provider,
      prepareArtifacts: makePreparation([], true),
    }),
    /artifact/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("missing bootstrap secret prevents provider deployment", async () => {
  const firstDeploymentObservations = observations(config, {
    workerExists: absent(),
    workerConfigFingerprint: absent(),
    nonSecretBindingNames: absent(),
    cronSchedules: absent(),
    secretNames: absent(),
    currentRelease: absent(),
    priorVersion: absent(),
    currentDeployment: absent(),
    workersDevEnabled: absent(),
    hostname: absent(),
  });
  const provider = makeProvider(firstDeploymentObservations);
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: firstDeploymentObservations,
      providerTarget: { ...validPlan().providerTarget, workerExists: false },
      mutationEnvelope: {
        workerAction: "CREATE_OR_UPDATE",
        cronAction: "CREATE_OR_CHANGE",
        secretNamesToSet: ["SUPABASE_SECRET_KEY"],
      },
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: true,
      }],
      rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    }), { provider, currentSecrets: undefined }),
    /secret/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("present remote secret does not receive unnecessary bootstrap input", async () => {
  const provider = makeProvider();
  await apply(validPlan(), { provider, currentSecrets: { supabaseSecretKey: "server-secret" } });
  assert.equal("bootstrapSecrets" in (provider.deployCalls[0] ?? {}), false);
});

test("apply reinspection occurs after local artifact preparation and dry-run", async () => {
  const order: string[] = [];
  const provider = makeProvider();
  const originalInspect = provider.inspectStructured;
  provider.inspectStructured = async (...args) => {
    order.push("inspect");
    return originalInspect(...args);
  };
  provider.deploy = async (input) => {
    order.push("deploy");
    provider.deployCalls.push(input);
    return { deploymentId: "deployment-1", providerVersionId: "version-1" };
  };

  await apply(validPlan(), {
    provider,
    prepareArtifacts: makePreparation(order),
    dryRun: async () => {
      order.push("dryRun");
    },
  });
  assert.deepEqual(order, ["prepare", "dryRun", "inspect", "deploy"]);
});

test("apply prepares and dry-runs before one fresh structured inspection and deploys immediately", async () => {
  const events: string[] = [];
  let dryRunEnvironment: NodeJS.ProcessEnv | undefined;
  const generatedConfig = buildCloudflareDeployment({ config, release }).wrangler;
  const structuredInspection: Vs005CorrelatedProviderInspection = {
    correlation: {
      accountId: config.cloudflare!.accountId,
      workerName: config.cloudflare!.workerName,
      configFingerprint: fingerprintCadenceRuntimeConfig(config),
      providerOrigin: "api.cloudflare.com",
      profile: "FIRST_DEPLOYMENT_READINESS",
      completedOperations: [
        "CURRENT_DEPLOYMENT",
        "WORKER_SETTINGS",
        "CRON_SCHEDULES",
        "WORKER_SUBDOMAIN",
        "ACCOUNT_SUBDOMAIN",
      ],
      observedAt: "2026-09-10T00:00:00.000Z",
    },
    observations: {
      ...observations(),
      currentDeployment: {
        state: "OBSERVED_VALUE",
        value: { deploymentId: "deployment-current", versions: [{ providerVersionId: "version-current", percentage: 100 }] },
      },
      workersDevEnabled: observed(true),
      accountWorkersDevSubdomain: observed("ngohch-3d6"),
    },
  };
  const provider = {
    structuredCalls: 0,
    legacyCalls: 0,
    deployCalls: 0,
    async inspectStructured() {
      events.push("freshInspection");
      provider.structuredCalls += 1;
      return structuredInspection;
    },
    async inspect() {
      provider.legacyCalls += 1;
      throw new Error("LEGACY_AUTHORITY_FORBIDDEN");
    },
    async deploy() {
      events.push("deploy");
      provider.deployCalls += 1;
      return { deploymentId: "deployment-1", providerVersionId: "version-1" };
    },
  };
  const result = await apply(validPlan({
    providerCorrelation: {
      ...structuredInspection.correlation,
      observedAt: "2026-09-09T00:00:00.000Z",
    },
    observedProvider: structuredInspection.observations,
  } as never), {
    provider: provider as never,
    prepareArtifacts: async () => {
      events.push("artifactPrepare");
      return { generatedWranglerPath: "wrangler.generated.jsonc", generatedConfig };
    },
    environment: {
      CLOUDFLARE_INSPECTION_API_TOKEN: "inspection-token-canary",
      CLOUDFLARE_API_TOKEN: "deployment-auth-canary",
      UNRELATED_SETTING: "preserved",
    },
    dryRun: async (input: { childEnvironment: NodeJS.ProcessEnv }) => {
      events.push("dryRun");
      dryRunEnvironment = input.childEnvironment;
    },
    recordEvent: (event: string) => events.push(event),
  } as never);

  assert.deepEqual(events, ["artifactPrepare", "dryRun", "freshInspection", "finalGate", "deploy"]);
  assert.equal(provider.structuredCalls, 1);
  assert.equal(provider.legacyCalls, 0);
  assert.equal(provider.deployCalls, 1);
  assert.equal(isVs005CorrelatedDeploymentResult(result), true);
  assert.equal(dryRunEnvironment?.CLOUDFLARE_INSPECTION_API_TOKEN, undefined);
  assert.equal(dryRunEnvironment?.CLOUDFLARE_API_TOKEN, "deployment-auth-canary");
  assert.equal(dryRunEnvironment?.UNRELATED_SETTING, "preserved");
});

test("secret-looking provider fields never enter apply evidence or errors", async () => {
  const unsafe = observations(config, {
    accountId: observed("token=secret-value"),
  }) as Vs005StructuredProviderObservationSnapshot & { secretValue?: string };
  unsafe.secretValue = "server-secret-must-not-escape";
  const provider = makeProvider(unsafe);

  await assert.rejects(() => apply(validPlan(), { provider }), /target|account|provider|drift/i);
  assert.equal(provider.deployCalls.length, 0);
});

test("exact reviewed result has safe deployment provenance", async () => {
  const result: Vs005DeploymentResult = await apply(validPlan());
  assert.equal(result.artifactType, "cadence.vs005.deployment-result");
  assert.equal(result.providerVersionId, "version-1");
  assert.deepEqual(result.intendedTarget, VS005_BETA_TARGET_POLICY.expected);
  assert.equal(result.release.commitSha, release.commitSha);
  assert.equal(result.configFingerprint, fingerprintCadenceRuntimeConfig(config));
  assert.equal(result.databaseAction, "NONE");
  assert.deepEqual(result.destructiveActions, []);
});
