import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { runSupabaseDbPush } from "./run-supabase-db-push";

const configPath = resolve(
  process.cwd(),
  "../../config/cadence.runtime.ci.json",
);

test("uses only the validated project ref returned by target assertion", () => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];

  const result = runSupabaseDbPush({
    expectedEnvironment: "beta",
    configPath,
    linkedProjectRef: "abc123",
    dbPasswordPresent: true,
    dryRun: true,
    spawnSync: (command, args) => {
      calls.push({ command, args });
      return { status: 0 };
    },
  });

  assert.equal(result, 0);
  assert.deepEqual(calls, [{
    command: "npx",
    args: ["supabase", "db", "push", "--project-ref", "abc123", "--dry-run"],
  }]);
});
