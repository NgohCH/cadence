import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function requireIndex(source: string, value: string, description: string): number {
  const index = source.indexOf(value);
  assert.notEqual(index, -1, `${description} was not found.`);
  return index;
}

test("server bootstraps canonical config, secrets, release, and runtime-neutral composition", () => {
  const source = readSource("src/server.ts");
  const configPathIndex = requireIndex(source, "resolveCadenceConfigPath(", "config locator");
  const configIndex = requireIndex(source, "loadCadenceRuntimeConfig(", "canonical config load");
  const secretsIndex = requireIndex(source, "resolveCadenceSecrets(", "configured secret resolution");
  const releaseIndex = requireIndex(source, "loadCadenceReleaseIdentity(", "release identity load");
  const appIndex = requireIndex(source, "createCadenceApp(", "runtime-neutral app composition");

  assert.ok(configPathIndex < configIndex);
  assert.ok(configIndex < secretsIndex);
  assert.ok(secretsIndex < releaseIndex);
  assert.ok(releaseIndex < appIndex);
  assert.doesNotMatch(source, /new Supabase(?:AuthProvider|[A-Z])/);
  assert.doesNotMatch(source, /new (?:Identity|Projects|ProjectMembership|Discussion|Tasks|TeamAgent)/);
});

test("canonical configuration remains the only runtime caller of the pure safety guard", () => {
  const configSource = readSource("src/bootstrap/cadence-config.ts");
  const safetySource = readSource("src/bootstrap/environment-safety.ts");
  assert.match(configSource, /validateCadenceEnvironmentSafety\(/);
  assert.doesNotMatch(safetySource, /process\.env|readFileSync|Cloudflare/);
});

test("runtime-neutral composition has no process environment access", () => {
  const source = readSource("src/runtime/create-cadence-app.ts");
  assert.doesNotMatch(source, /process\.env/);
});

test("worker consumes canonical configuration before the bounded cycle", () => {
  const source = readSource("src/worker.ts");
  const configPathIndex = requireIndex(source, "resolveCadenceConfigPath(", "config locator");
  const configIndex = requireIndex(source, "loadCadenceRuntimeConfig(", "canonical config load");
  const secretsIndex = requireIndex(source, "resolveCadenceSecrets(", "configured secret resolution");
  const releaseIndex = requireIndex(source, "loadCadenceReleaseIdentity(", "release identity load");
  const cycleIndex = requireIndex(source, "runCadenceWorkerCycle(", "bounded worker cycle");
  const servicesIndex = requireIndex(source, "createCadenceWorkerServices(", "worker service composition");

  assert.ok(configPathIndex < configIndex);
  assert.ok(configIndex < secretsIndex);
  assert.ok(secretsIndex < releaseIndex);
  assert.ok(releaseIndex < cycleIndex);
  assert.ok(cycleIndex < servicesIndex);
  assert.doesNotMatch(source, /process\.env\.CADENCE_ENV/);
  assert.doesNotMatch(source, /process\.env\.CADENCE_SUPABASE_PROJECT_REF/);
  assert.doesNotMatch(source, /validateCadenceEnvironmentSafety\(/);
  assert.doesNotMatch(source, /createClient\(/);
});
