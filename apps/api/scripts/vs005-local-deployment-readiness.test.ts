import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { validateCadenceRuntimeConfig } from "../src/bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import { buildCadencePublicWebConfig } from "./vs005-generate-web-config";
import {
  inspectVs005LocalDeploymentReadiness,
  isGeneratedCloudflareDeploymentValid,
  type Vs005LocalDeploymentReadinessIo,
} from "./vs005-local-deployment-readiness";

const config = validateCadenceRuntimeConfig(JSON.parse(readFileSync(
  resolve(process.cwd(), "../../config/cadence.runtime.ci.json"),
  "utf8",
)));
const release: CadenceReleaseIdentity = {
  version: "1.2.3",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-09T00:00:00Z",
};
const configPath = resolve("virtual/config.json");
const publicConfigPath = resolve("virtual/web/.generated/cadence-public-config.json");
const webDistPath = resolve("virtual/web/dist");
const indexPath = join(webDistPath, "index.html");
const webRoot = resolve("virtual/web");
const nodeExecutable = resolve("virtual/node.exe");
const typescriptPackagePath = resolve("virtual/node_modules/typescript/package.json");
const typescriptCliPath = resolve("virtual/node_modules/typescript/bin/tsc");
const vitePackagePath = resolve("virtual/node_modules/vite/package.json");
const viteCliPath = resolve("virtual/node_modules/vite/bin/vite.js");

function harness(input: {
  platform?: NodeJS.Platform;
  publicConfig?: unknown;
  html?: string;
  missing?: readonly string[];
  commandFailureAt?: number;
  readFailure?: string;
  missingPackage?: "typescript" | "vite";
  typescriptPackage?: unknown;
  vitePackage?: unknown;
} = {}) {
  const commands: string[][] = [];
  const files = new Map<string, string>([
    [publicConfigPath, JSON.stringify(input.publicConfig ?? buildCadencePublicWebConfig(config))],
    [indexPath, input.html ?? '<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">'],
    [join(webDistPath, "assets/app.js"), "javascript"],
    [join(webDistPath, "assets/app.css"), "css"],
    [typescriptPackagePath, JSON.stringify(input.typescriptPackage ?? {
      name: "typescript",
      bin: { tsc: "./bin/tsc", tsserver: "./bin/tsserver" },
    })],
    [typescriptCliPath, "typescript-cli"],
    [vitePackagePath, JSON.stringify(input.vitePackage ?? {
      name: "vite",
      bin: { vite: "bin/vite.js" },
    })],
    [viteCliPath, "vite-cli"],
  ]);
  for (const path of input.missing ?? []) files.delete(path);
  let commandIndex = 0;
  const io: Vs005LocalDeploymentReadinessIo & {
    nodeExecutable: string;
    resolvePackageJson(packageName: string, packageRoot: string): string;
    fileIsRegular(path: string): boolean;
    realPath(path: string): string;
  } = {
    platform: input.platform ?? "linux",
    nodeExecutable,
    resolvePackageJson: (packageName, packageRoot) => {
      assert.equal(packageRoot, webRoot);
      if (packageName === input.missingPackage) throw new Error("missing-package-canary");
      if (packageName === "typescript") return typescriptPackagePath;
      if (packageName === "vite") return vitePackagePath;
      throw new Error("unexpected-package");
    },
    fileIsRegular: (path) => files.has(path),
    realPath: (path) => path,
    runCommand: async (argv) => {
      assert.equal(Array.isArray(argv), true);
      commands.push([...argv]);
      commandIndex += 1;
      if (commandIndex === input.commandFailureAt) throw new Error("command-canary");
    },
    readText: (path) => {
      if (path === input.readFailure) throw new Error("read-canary");
      const value = files.get(path);
      if (value === undefined) throw new Error("missing");
      return value;
    },
    fileExists: (path) => files.has(path),
  };
  return { io, commands };
}

test("generated deployment validation rejects every governed-field tamper", () => {
  const valid = buildCloudflareDeployment({ config, release }).wrangler;
  assert.equal(isGeneratedCloudflareDeploymentValid({ config, release, generatedConfig: valid }), true);

  const tampers: Array<(value: typeof valid) => void> = [
    (value) => { value.account_id = "other-account"; },
    (value) => { value.name = "other-worker"; },
    (value) => { value.vars.CADENCE_CONFIG_FINGERPRINT = "0".repeat(64); },
    (value) => { value.vars.CADENCE_RELEASE_VERSION = "9.9.9"; },
    (value) => { value.vars.CADENCE_COMMIT_SHA = "f".repeat(40); },
    (value) => { value.vars.CADENCE_BUILD_ID = "other-build"; },
    (value) => { value.vars.CADENCE_RUNTIME_CONFIG_JSON = "{}"; },
    (value) => { (value.assets as { binding: string }).binding = "OTHER"; },
    (value) => { value.triggers.crons = ["5 * * * *"]; },
    (value) => { value.secrets.required = ["OTHER_SECRET"]; },
    (value) => { value.workers_dev = true; },
    (value) => { delete value.routes; },
    (value) => { value.main = "other.ts"; },
    (value) => { value.compatibility_date = "2026-09-05" as never; },
    (value) => { value.compatibility_flags = [] as never; },
  ];
  for (const tamper of tampers) {
    const candidate = structuredClone(valid);
    tamper(candidate);
    assert.equal(isGeneratedCloudflareDeploymentValid({ config, release, generatedConfig: candidate }), false);
  }
});

test("local readiness runs shell-free portable argv and validates web artifacts", async () => {
  const { io, commands } = harness();
  let providerCalls = 0;
  let hostedHttpCalls = 0;
  const guardedIo = Object.assign(io, {
    inspectProvider: async () => { providerCalls += 1; },
    readHostedHttp: async () => { hostedHttpCalls += 1; },
  });
  const result = await inspectVs005LocalDeploymentReadiness({
    config,
    configPath,
    release,
    publicConfigPath,
    webDistPath,
    io: guardedIo,
  });

  assert.deepEqual(result, { generatedConfigValid: true, webBuildReady: true });
  assert.deepEqual(commands, [
    ["node", "--import", "tsx", "scripts/vs005-generate-web-config.ts", "--config", configPath, "--out", publicConfigPath],
    [nodeExecutable, typescriptCliPath, "-b", webRoot],
    [nodeExecutable, viteCliPath, "build", webRoot, "--mode", "beta"],
  ]);
  assert.equal(commands.slice(1).flat().some((value) => /^(?:npm|npx|pnpm|yarn)(?:\.cmd)?$|^(?:cmd|powershell)(?:\.exe)?$/i.test(value)), false);
  assert.equal(commands.flat().some((value) => /^https?:|wrangler|cloudflare/i.test(value)), false);
  assert.equal(providerCalls, 0);
  assert.equal(hostedHttpCalls, 0);
});

test("missing or malformed local web CLI metadata fails readiness closed", async () => {
  const cases = [
    harness({ missingPackage: "typescript" }).io,
    harness({ missingPackage: "vite" }).io,
    harness({ missing: [typescriptCliPath] }).io,
    harness({ missing: [viteCliPath] }).io,
    harness({ typescriptPackage: { name: "typescript", bin: { tsc: "../outside.js" } } }).io,
    harness({ vitePackage: { name: "vite", bin: { vite: ["bin/vite.js"] } } }).io,
  ];
  for (const io of cases) {
    const result = await inspectVs005LocalDeploymentReadiness({
      config,
      configPath,
      release,
      publicConfigPath,
      webDistPath,
      io,
    });
    assert.deepEqual(result, { generatedConfigValid: true, webBuildReady: false });
  }
});

test("public config must exactly match the browser-safe projection", async () => {
  for (const publicConfig of [
    { ...buildCadencePublicWebConfig(config), extra: "server-only-canary" },
    { ...buildCadencePublicWebConfig(config), supabaseSecretKey: "secret-canary" },
    { cadenceEnvironment: config.application.environment },
  ]) {
    const { io } = harness({ publicConfig });
    const result = await inspectVs005LocalDeploymentReadiness({ config, configPath, release, publicConfigPath, webDistPath, io });
    assert.equal(result.generatedConfigValid, true);
    assert.equal(result.webBuildReady, false);
    assert.doesNotMatch(JSON.stringify(result), /server-only-canary|secret-canary/);
  }
});

test("index and every local script or stylesheet asset are required", async () => {
  for (const missing of [[indexPath], [join(webDistPath, "assets/app.js")], [join(webDistPath, "assets/app.css")]]) {
    const { io } = harness({ missing });
    const result = await inspectVs005LocalDeploymentReadiness({ config, configPath, release, publicConfigPath, webDistPath, io });
    assert.equal(result.webBuildReady, false);
  }
});

test("traversal and non-local script or stylesheet references are rejected", async () => {
  for (const html of [
    '<script src="/assets/../secret.js"></script>',
    '<script src="https://cdn.example/app.js"></script>',
    '<script src="//cdn.example/app.js"></script>',
    '<link rel="stylesheet" href="../assets/app.css">',
    '<link rel="stylesheet" href="/assets/%2e%2e/secret.css">',
  ]) {
    const { io } = harness({ html });
    const result = await inspectVs005LocalDeploymentReadiness({ config, configPath, release, publicConfigPath, webDistPath, io });
    assert.equal(result.webBuildReady, false);
  }
});

test("command, read, and parse failures fail closed without affecting generated config", async () => {
  const cases = [
    harness({ commandFailureAt: 2 }).io,
    harness({ readFailure: publicConfigPath }).io,
    harness({ publicConfig: "not-json" }).io,
  ];
  for (const io of cases) {
    if (io === cases[2]) {
      const originalRead = io.readText;
      io.readText = (path) => path === publicConfigPath ? "not-json" : originalRead(path);
    }
    const result = await inspectVs005LocalDeploymentReadiness({ config, configPath, release, publicConfigPath, webDistPath, io });
    assert.deepEqual(result, { generatedConfigValid: true, webBuildReady: false });
  }
});
