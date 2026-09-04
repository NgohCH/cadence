import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  loadCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";

export interface CadencePublicWebConfig {
  cadenceEnvironment: "local" | "qa" | "beta";
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectRef: string | null;
  projectId: string;
}

export function buildCadencePublicWebConfig(
  config: CadenceRuntimeConfig,
): CadencePublicWebConfig {
  return {
    cadenceEnvironment: config.application.environment,
    apiBaseUrl: config.application.apiBaseUrl,
    supabaseUrl: config.supabase.url,
    supabasePublishableKey: config.supabase.publishableKey,
    supabaseProjectRef: config.supabase.projectRef,
    projectId: config.pilot.projectId,
  };
}

function parseArguments(args: readonly string[]): { configPath: string; outPath: string } {
  let configPath: string | undefined;
  let outPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (argument === "--out" && value) {
      outPath = value;
      index += 1;
    } else {
      throw new Error("Usage: vs005-generate-web-config.ts --config <path> --out <path>");
    }
  }

  if (!configPath || !outPath) {
    throw new Error("Usage: vs005-generate-web-config.ts --config <path> --out <path>");
  }

  return { configPath, outPath };
}

export function writeCadencePublicWebConfig(
  config: CadenceRuntimeConfig,
  outPath: string,
): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(buildCadencePublicWebConfig(config), null, 2)}\n`,
    "utf8",
  );
}

export function runCadenceWebConfigGenerator(args: readonly string[]): void {
  const { configPath, outPath } = parseArguments(args);
  const config = loadCadenceRuntimeConfig(configPath);
  writeCadencePublicWebConfig(config, outPath);
}

if (require.main === module) {
  runCadenceWebConfigGenerator(process.argv.slice(2));
}
