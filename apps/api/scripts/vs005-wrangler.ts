import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

const WRANGLER_RELATIVE_PATH = "apps/runtime-cloudflare/node_modules/wrangler/bin/wrangler.js";

export function resolveCadenceWranglerExecutable(repositoryRoot: string): string {
  const executable = resolve(repositoryRoot, WRANGLER_RELATIVE_PATH);
  try {
    accessSync(executable, constants.F_OK);
  } catch {
    throw new Error("CADENCE_WRANGLER_EXECUTABLE_UNAVAILABLE");
  }
  return executable;
}

export function resolveCadenceWranglerCommand(
  args: readonly string[],
  repositoryRoot: string,
): readonly string[] {
  if (args[0] !== "wrangler") return args;
  return [process.execPath, resolveCadenceWranglerExecutable(repositoryRoot), ...args.slice(1)];
}
