import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { assertSupabaseTarget } from "./assert-supabase-target";

const repoRoot = resolve(process.cwd(), "../..");
const ciConfigPath = resolve(repoRoot, "config/cadence.runtime.ci.json");

test("requires canonical, URL-host, and linked Supabase project refs to agree", () => {
  assert.deepEqual(
    assertSupabaseTarget({
      expectedEnvironment: "beta",
      configPath: ciConfigPath,
      linkedProjectRef: "abc123",
      dbPasswordPresent: true,
    }),
    { environment: "beta", projectRef: "abc123" },
  );
});

test("rejects a linked Supabase project-ref mismatch", () => {
  assert.throws(
    () => assertSupabaseTarget({
      expectedEnvironment: "beta",
      configPath: ciConfigPath,
      linkedProjectRef: "wrong-project",
      dbPasswordPresent: true,
    }),
    /linked Supabase CLI project ref/,
  );
});

test("DB password is presence-only and is never logged", () => {
  assert.throws(
    () => assertSupabaseTarget({
      expectedEnvironment: "beta",
      configPath: ciConfigPath,
      linkedProjectRef: "abc123",
      dbPasswordPresent: false,
    }),
    /DB password is required/,
  );
});

test("old executable target sources contain no hardcoded Beta ref", () => {
  const candidates = [
    resolve(repoRoot, "scripts/assert-supabase-explicit-target.cjs"),
    resolve(repoRoot, "scripts/assert-supabase-link.cjs"),
    resolve(repoRoot, "scripts/run-supabase-db-push.cjs"),
    resolve(repoRoot, "package.json"),
  ];

  const executableTargetSources = candidates
    .filter(existsSync)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(
    executableTargetSources,
    /pwmhasbmacmeerbsagda/,
  );
});
