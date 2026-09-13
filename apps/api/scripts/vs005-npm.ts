import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";

function resolveNpmCliPath(environment: NodeJS.ProcessEnv): string {
  const npmCliPath = environment.npm_execpath;
  if (!npmCliPath || !isAbsolute(npmCliPath)) {
    throw new Error("CADENCE_NPM_EXECUTABLE_UNAVAILABLE");
  }
  try {
    accessSync(npmCliPath, constants.F_OK | constants.R_OK);
    if (!statSync(npmCliPath).isFile()) throw new Error("CADENCE_NPM_EXECUTABLE_UNAVAILABLE");
  } catch {
    throw new Error("CADENCE_NPM_EXECUTABLE_UNAVAILABLE");
  }
  return npmCliPath;
}

export function resolveCadenceNpmCommand(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  if (process.platform !== "win32" || args[0] !== "npm.cmd") return args;
  return [process.execPath, resolveNpmCliPath(environment), ...args.slice(1)];
}
