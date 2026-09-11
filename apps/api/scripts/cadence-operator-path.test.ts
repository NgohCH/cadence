import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve, win32 } from "node:path";
import test from "node:test";

import {
  resolveCadenceOperatorPath,
  resolveCadenceRepositoryRoot,
  resolveCadenceRepositoryRootFromFixture,
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

test("accepts exact cadence, api, and web package markers", () => {
  const root = makeFixture();
  try {
    assert.equal(resolveCadenceRepositoryRootFromFixture(join(root, "apps", "api", "scripts")), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed when repository identity markers are missing or mismatched", () => {
  for (const overrides of [{ root: "other" }, { api: "other" }, { web: "other" }]) {
    const root = makeFixture(overrides);
    try {
      assert.throws(
        () => resolveCadenceRepositoryRootFromFixture(join(root, "apps", "api", "scripts")),
        /CADENCE_REPOSITORY_ROOT_INVALID/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

test("rejects invalid repository roots and operator path values", () => {
  assert.throws(() => resolveCadenceOperatorPath({ repositoryRoot: "relative", inputPath: "plan.json" }), /CADENCE_OPERATOR_PATH_INVALID/);
  for (const inputPath of ["", "\0bad", "line\nbreak"]) {
    assert.throws(() => resolveCadenceOperatorPath({ repositoryRoot: "C:/repo", inputPath }), /CADENCE_OPERATOR_PATH_INVALID/);
  }
});

test("does not use cwd, INIT_CWD, Git, upward search, or process.chdir authority", () => {
  const source = readFileSync(join(__dirname, "cadence-operator-path.ts"), "utf8");
  assert.doesNotMatch(source, /process\.cwd\(|INIT_CWD|process\.chdir\(|git|upward/i);
});
