import { readFileSync, statSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

const ROOT_ERROR = "CADENCE_REPOSITORY_ROOT_INVALID";
const PATH_ERROR = "CADENCE_OPERATOR_PATH_INVALID";

function packageName(path: string): string {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof value !== "object" || value === null || !("name" in value) || typeof value.name !== "string") {
      throw new Error(ROOT_ERROR);
    }
    return value.name;
  } catch {
    throw new Error(ROOT_ERROR);
  }
}

function assertRepositoryIdentity(candidate: string): string {
  if (!isAbsolute(candidate)) throw new Error(ROOT_ERROR);
  const apps = resolve(candidate, "apps");
  const api = resolve(apps, "api");
  const web = resolve(apps, "web");
  try {
    if (!statSync(candidate).isDirectory() || !statSync(apps).isDirectory()) throw new Error(ROOT_ERROR);
    if (!statSync(api).isDirectory() || !statSync(web).isDirectory()) throw new Error(ROOT_ERROR);
    if (packageName(resolve(candidate, "package.json")) !== "cadence") throw new Error(ROOT_ERROR);
    if (packageName(resolve(api, "package.json")) !== "api") throw new Error(ROOT_ERROR);
    if (packageName(resolve(web, "package.json")) !== "web") throw new Error(ROOT_ERROR);
    return candidate;
  } catch {
    throw new Error(ROOT_ERROR);
  }
}

function deriveRepositoryRoot(moduleDirectory: string): string {
  return assertRepositoryIdentity(resolve(moduleDirectory, "..", "..", ".."));
}

export function resolveCadenceRepositoryRoot(): string {
  return deriveRepositoryRoot(__dirname);
}

export function resolveCadenceOperatorPath(input: {
  repositoryRoot: string;
  inputPath: string;
}): string {
  if (!isAbsolute(input.repositoryRoot) || typeof input.inputPath !== "string" || input.inputPath.length === 0) {
    throw new Error(PATH_ERROR);
  }
  if (input.inputPath.includes("\0") || /[\r\n]/.test(input.inputPath)) throw new Error(PATH_ERROR);
  return isAbsolute(input.inputPath)
    ? normalize(input.inputPath)
    : resolve(input.repositoryRoot, input.inputPath);
}
