import { spawnSync as defaultSpawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  resolveCadenceConfigPath,
} from "../src/bootstrap/cadence-config";
import { assertSupabaseTarget } from "./assert-supabase-target";

type SpawnSync = (
  command: string,
  args: readonly string[],
  options?: { stdio?: "inherit" },
) => { status: number | null; error?: Error };

export function runSupabaseDbPush(input: {
  expectedEnvironment: "qa" | "beta";
  configPath: string;
  linkedProjectRef: string;
  dbPasswordPresent: boolean;
  dryRun: boolean;
  spawnSync?: SpawnSync;
}): number {
  const target = assertSupabaseTarget(input);
  const args = [
    "supabase",
    "db",
    "push",
    "--project-ref",
    target.projectRef,
  ];
  if (input.dryRun) args.push("--dry-run");

  const result = (input.spawnSync ?? defaultSpawnSync)("npx", args, {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function linkedProjectRef(): string {
  const path = resolve(process.cwd(), "../../supabase/.temp/project-ref");
  if (!existsSync(path)) {
    throw new Error("Supabase CLI is not linked to a remote project.");
  }
  const value = readFileSync(path, "utf8").trim();
  if (!value) throw new Error("Supabase CLI linked project ref is empty.");
  return value;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  try {
    const expectedEnvironment = argumentValue("--env");
    if (expectedEnvironment !== "qa" && expectedEnvironment !== "beta") {
      throw new Error("--env must be qa or beta");
    }
    const configPath = resolveCadenceConfigPath({
      argv: process.argv.slice(2),
      environment: process.env,
    });
    const status = runSupabaseDbPush({
      expectedEnvironment,
      configPath,
      linkedProjectRef: linkedProjectRef(),
      dbPasswordPresent: Boolean(process.env.SUPABASE_DB_PASSWORD?.trim()),
      dryRun: process.argv.includes("--dry-run"),
    });
    process.exitCode = status;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
