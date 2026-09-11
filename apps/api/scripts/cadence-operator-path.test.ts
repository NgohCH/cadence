import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, win32, posix } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  resolveCadenceOperatorPath,
  resolveCadenceRepositoryRoot,
} from "./cadence-operator-path";

function makeFixture(overrides: Partial<Record<"root" | "api" | "web", string>> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "cadence-root-"));
  mkdirSync(join(root, "apps", "api", "scripts"), { recursive: true });
  mkdirSync(join(root, "apps", "web"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: overrides.root ?? "cadence" }));
  writeFileSync(join(root, "apps", "api", "package.json"), JSON.stringify({ name: overrides.api ?? "api" }));
  writeFileSync(join(root, "apps", "web", "package.json"), JSON.stringify({ name: overrides.web ?? "web" }));
  return root;
}

test("derives the repository root from the resolver module location", () => {
  const expected = resolve(__dirname, "..", "..", "..");
  assert.equal(resolveCadenceRepositoryRoot(), expected);
});

async function loadFixtureResolver(markers: { root?: string; api?: string; web?: string; malformed?: string }): Promise<() => string> {
  const root = mkdtempSync(join(tmpdir(), "cadence-resolver-"));
  try {
    mkdirSync(join(root, "apps", "api", "scripts"), { recursive: true });
    mkdirSync(join(root, "apps", "web"), { recursive: true });
    if (markers.root !== undefined) writeFileSync(join(root, "package.json"), markers.root);
    if (markers.api !== undefined) writeFileSync(join(root, "apps", "api", "package.json"), markers.api);
    if (markers.web !== undefined) writeFileSync(join(root, "apps", "web", "package.json"), markers.web);
    const source = join(__dirname, "cadence-operator-path.ts");
    const copied = join(root, "apps", "api", "scripts", "cadence-operator-path.ts");
    copyFileSync(source, copied);
    const loaded = await import(`${pathToFileURL(copied).href}?fixture=${Date.now()}-${Math.random()}`) as {
      resolveCadenceRepositoryRoot: () => string;
    };
    return loaded.resolveCadenceRepositoryRoot;
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test("accepts exact cadence, api, and web package markers", async () => {
  const resolveFixtureRoot = await loadFixtureResolver({ root: '{"name":"cadence"}', api: '{"name":"api"}', web: '{"name":"web"}' });
  assert.match(resolveFixtureRoot(), /cadence-resolver-/);
});

test("fails closed for each missing repository identity marker", async () => {
  for (const missing of ["root", "api", "web"] as const) {
    const markers = { root: '{"name":"cadence"}', api: '{"name":"api"}', web: '{"name":"web"}' };
    delete markers[missing];
    const resolveFixtureRoot = await loadFixtureResolver(markers);
    assert.throws(resolveFixtureRoot, /CADENCE_REPOSITORY_ROOT_INVALID/);
  }
});

test("fails closed for malformed package JSON", async () => {
  const resolveFixtureRoot = await loadFixtureResolver({ root: "{", api: '{"name":"api"}', web: '{"name":"web"}' });
  assert.throws(resolveFixtureRoot, /CADENCE_REPOSITORY_ROOT_INVALID/);
});

test("fails closed for mismatched package identity", async () => {
  for (const markers of [
    { root: '{"name":"other"}', api: '{"name":"api"}', web: '{"name":"web"}' },
    { root: '{"name":"cadence"}', api: '{"name":"other"}', web: '{"name":"web"}' },
    { root: '{"name":"cadence"}', api: '{"name":"api"}', web: '{"name":"other"}' },
  ]) {
    const resolveFixtureRoot = await loadFixtureResolver(markers);
    assert.throws(resolveFixtureRoot, /CADENCE_REPOSITORY_ROOT_INVALID/);
  }
});

test("resolves relative operator paths from the proven repository root", () => {
  assert.equal(
    resolveCadenceOperatorPath({ repositoryRoot: "C:/repo", inputPath: "./.cadence/../plan.json" }),
    win32.normalize("C:/repo/plan.json"),
  );
});

test("preserves absolute paths while normalizing dot segments and spaces", () => {
  const absolute = win32.normalize("C:/Operator Files/../Operator Files/plan.json");
  assert.equal(
    resolveCadenceOperatorPath({ repositoryRoot: "C:/repo", inputPath: "C:/Operator Files/../Operator Files/plan.json" }),
    absolute,
  );
});

test("preserves POSIX absolute paths while normalizing dot segments", { skip: process.platform === "win32" }, () => {
  assert.equal(
    resolveCadenceOperatorPath({ repositoryRoot: "/repo", inputPath: "/operator/../operator/plan.json" }),
    posix.normalize("/operator/plan.json"),
  );
});

test("rejects invalid repository roots and operator path values", () => {
  assert.throws(() => resolveCadenceOperatorPath({ repositoryRoot: "relative", inputPath: "plan.json" }), /CADENCE_OPERATOR_PATH_INVALID/);
  for (const inputPath of ["", "\0bad", "line\nbreak"]) {
    assert.throws(() => resolveCadenceOperatorPath({ repositoryRoot: "C:/repo", inputPath }), /CADENCE_OPERATOR_PATH_INVALID/);
  }
});

test("does not use cwd, INIT_CWD, Git, upward search, or process.chdir authority", () => {
  const source = readFileSync(join(__dirname, "cadence-operator-path.ts"), "utf8");
  assert.doesNotMatch(source, /process\.cwd\(|INIT_CWD|process\.chdir\(|git|upward/i);
  assert.doesNotMatch(source, /resolveCadenceRepositoryRootFromFixture/);
});
