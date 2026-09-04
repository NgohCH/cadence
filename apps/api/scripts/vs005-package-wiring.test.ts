import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(process.cwd(), "../..");
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const apiPackage = JSON.parse(readFileSync(resolve(repoRoot, "apps/api/package.json"), "utf8"));
const cloudflarePackage = JSON.parse(readFileSync(resolve(repoRoot, "apps/runtime-cloudflare/package.json"), "utf8"));
const workflow = readFileSync(resolve(repoRoot, ".github/workflows/quality.yml"), "utf8");
const nodeVersion = readFileSync(resolve(repoRoot, ".node-version"), "utf8").trim();

test("root exposes the governed VS005 operator commands", () => {
  for (const name of [
    "cadence:setup:check",
    "cadence:deploy:plan",
    "cadence:deploy:apply",
    "cadence:deploy:verify",
    "cadence:rollback",
  ]) {
    assert.equal(typeof rootPackage.scripts[name], "string", name);
  }
});

test("release toolchain declares the same Node major used by CI", () => {
  assert.equal(rootPackage.engines.node, ">=24 <25");
  assert.equal(nodeVersion, "24");
  assert.match(workflow, /node-version:\s*['"]?24['"]?/);
});

test("authoritative quality includes config, web tests, and non-mutating Cloudflare checks", () => {
  assert.equal(typeof apiPackage.scripts["vs005:generate:ci"], "string");
  assert.equal(typeof cloudflarePackage.scripts.test, "string");
  assert.equal(typeof cloudflarePackage.scripts.typecheck, "string");
  assert.equal(typeof cloudflarePackage.scripts["deploy:dry-run"], "string");

  const quality = rootPackage.scripts.quality;
  assert.match(quality, /api:scripts:typecheck/);
  assert.match(quality, /apps\/web test/);
  assert.match(quality, /vs005:generate:ci/);
  assert.match(quality, /apps\/runtime-cloudflare test/);
  assert.match(quality, /apps\/runtime-cloudflare run typecheck/);
  assert.match(quality, /deploy:dry-run/);

  assert.match(workflow, /working-directory:\s*apps\/runtime-cloudflare/);
  assert.match(workflow, /npm run quality/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy(?![^\n]*--dry-run)/);
});
