import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
} from "../src/bootstrap/cadence-config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function assertSupabaseTarget(input: {
  expectedEnvironment: "qa" | "beta";
  configPath: string;
  linkedProjectRef: string;
  dbPasswordPresent: boolean;
}): {
  environment: "qa" | "beta";
  projectRef: string;
} {
  const config = loadCadenceRuntimeConfig(input.configPath);

  if (config.application.environment !== input.expectedEnvironment) {
    throw new Error(
      `Remote database command requires environment ${input.expectedEnvironment}.`,
    );
  }

  const projectRef = config.supabase.projectRef;
  if (!projectRef) {
    throw new Error("Hosted Supabase project ref is required.");
  }

  const parsedUrl = new URL(config.supabase.url);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== `${projectRef}.supabase.co`
  ) {
    throw new Error("Supabase URL does not match canonical project ref.");
  }

  if (input.linkedProjectRef.trim() !== projectRef) {
    throw new Error(
      `linked Supabase CLI project ref does not match canonical project ref ${projectRef}.`,
    );
  }

  if (!input.dbPasswordPresent) {
    throw new Error("DB password is required for the remote database command.");
  }

  return { environment: input.expectedEnvironment, projectRef };
}

if (require.main === module) {
  try {
    const environment = process.argv[process.argv.indexOf("--env") + 1];
    if (environment !== "qa" && environment !== "beta") {
      throw new Error("--env must be qa or beta");
    }
    const configPath = resolveCadenceConfigPath({
      argv: process.argv.slice(2),
      environment: process.env,
    });
    const linkedPath = resolve(process.cwd(), "../../supabase/.temp/project-ref");
    if (!existsSync(linkedPath)) {
      throw new Error("Supabase CLI is not linked to a remote project.");
    }
    const target = assertSupabaseTarget({
      expectedEnvironment: environment,
      configPath,
      linkedProjectRef: readFileSync(linkedPath, "utf8").trim(),
      dbPasswordPresent: Boolean(process.env.SUPABASE_DB_PASSWORD?.trim()),
    });
    console.log(`Cadence Supabase target passed: ${target.environment} -> ${target.projectRef}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
