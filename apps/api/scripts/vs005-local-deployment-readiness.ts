import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { fingerprintCadenceRuntimeConfig, type CadenceRuntimeConfig } from "../src/bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import { buildCloudflareDeployment, type GeneratedCloudflareDeployment } from "./vs005-generate-deployment";
import { buildCadencePublicWebConfig } from "./vs005-generate-web-config";

export interface Vs005LocalDeploymentReadiness {
  generatedConfigValid: boolean;
  webBuildReady: boolean;
}

export interface Vs005LocalDeploymentReadinessIo {
  runCommand(argv: readonly string[]): Promise<void>;
  readText(path: string): string;
  fileExists(path: string): boolean;
  platform: NodeJS.Platform;
  nodeExecutable?: string;
  resolvePackageJson?(packageName: string, webRoot: string): string;
  fileIsRegular?(path: string): boolean;
  realPath?(path: string): string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPathWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== ""
    && pathFromParent !== ".."
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent);
}

function resolvePackageCli(input: {
  packageName: "typescript" | "vite";
  binName: "tsc" | "vite";
  webRoot: string;
  io: Vs005LocalDeploymentReadinessIo;
}): string {
  const resolvePackageJson = input.io.resolvePackageJson ?? ((packageName, webRoot) => (
    createRequire(join(webRoot, "package.json")).resolve(`${packageName}/package.json`)
  ));
  const realPath = input.io.realPath ?? realpathSync.native;
  const fileIsRegular = input.io.fileIsRegular ?? ((path) => statSync(path).isFile());
  const packageJsonPath = realPath(resolvePackageJson(input.packageName, input.webRoot));
  if (!fileIsRegular(packageJsonPath)) throw new Error("LOCAL_WEB_CLI_PACKAGE_INVALID");
  const packageRoot = dirname(packageJsonPath);
  const metadata: unknown = JSON.parse(input.io.readText(packageJsonPath));
  if (!isRecord(metadata) || metadata.name !== input.packageName || !isRecord(metadata.bin)) {
    throw new Error("LOCAL_WEB_CLI_PACKAGE_INVALID");
  }
  const declaredBin = metadata.bin[input.binName];
  if (typeof declaredBin !== "string" || declaredBin.length === 0
    || isAbsolute(declaredBin) || /[\0\r\n]/.test(declaredBin)) {
    throw new Error("LOCAL_WEB_CLI_BIN_INVALID");
  }
  const cliPath = realPath(resolve(packageRoot, declaredBin));
  if (!isPathWithin(packageRoot, cliPath) || !fileIsRegular(cliPath)) {
    throw new Error("LOCAL_WEB_CLI_BIN_INVALID");
  }
  return cliPath;
}

export function isGeneratedCloudflareDeploymentValid(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  generatedConfig: GeneratedCloudflareDeployment["wrangler"];
}): boolean {
  try {
    const cloudflare = input.config.cloudflare;
    if (!cloudflare || input.config.runtime.provider !== "cloudflare") return false;
    const publicHostname = new URL(input.config.application.publicUrl).hostname;
    const workersDev = publicHostname.endsWith(".workers.dev");
    const expected: GeneratedCloudflareDeployment["wrangler"] = {
      account_id: cloudflare.accountId,
      name: cloudflare.workerName,
      main: "src/index.ts",
      compatibility_date: "2026-09-04",
      compatibility_flags: ["nodejs_compat"],
      assets: {
        directory: "../web/dist",
        binding: "ASSETS",
        run_worker_first: ["/api/*", "/health"],
        not_found_handling: "single-page-application",
      },
      triggers: { crons: [input.config.worker.schedule] },
      secrets: { required: [input.config.supabase.secretKeySecretRef] },
      workers_dev: workersDev,
      vars: {
        CADENCE_RUNTIME_CONFIG_JSON: JSON.stringify(input.config),
        CADENCE_CONFIG_FINGERPRINT: fingerprintCadenceRuntimeConfig(input.config),
        CADENCE_RELEASE_VERSION: input.release.version,
        CADENCE_COMMIT_SHA: input.release.commitSha,
        CADENCE_BUILD_ID: input.release.buildId,
      },
    };
    if (!workersDev) expected.routes = [{ pattern: publicHostname, custom_domain: true }];
    return JSON.stringify(input.generatedConfig) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

export async function inspectVs005LocalDeploymentReadiness(input: {
  config: CadenceRuntimeConfig;
  configPath: string;
  release: CadenceReleaseIdentity;
  publicConfigPath: string;
  webDistPath: string;
  io: Vs005LocalDeploymentReadinessIo;
}): Promise<Vs005LocalDeploymentReadiness> {
  let generatedConfigValid = false;
  try {
    generatedConfigValid = isGeneratedCloudflareDeploymentValid({
      config: input.config,
      release: input.release,
      generatedConfig: buildCloudflareDeployment({ config: input.config, release: input.release }).wrangler,
    });
  } catch {
    generatedConfigValid = false;
  }

  let webBuildReady = false;
  try {
    const webRoot = resolve(input.webDistPath, "..");
    const nodeExecutable = input.io.nodeExecutable ?? process.execPath;
    const typescriptCli = resolvePackageCli({ packageName: "typescript", binName: "tsc", webRoot, io: input.io });
    const viteCli = resolvePackageCli({ packageName: "vite", binName: "vite", webRoot, io: input.io });
    await input.io.runCommand([
      "node",
      "--import",
      "tsx",
      "scripts/vs005-generate-web-config.ts",
      "--config",
      input.configPath,
      "--out",
      input.publicConfigPath,
    ]);
    await input.io.runCommand([nodeExecutable, typescriptCli, "-b", webRoot]);
    await input.io.runCommand([nodeExecutable, viteCli, "build", webRoot, "--mode", "beta"]);
    webBuildReady = validateWebBuild(input);
  } catch {
    webBuildReady = false;
  }
  return { generatedConfigValid, webBuildReady };
}

function validateWebBuild(input: {
  config: CadenceRuntimeConfig;
  publicConfigPath: string;
  webDistPath: string;
  io: Pick<Vs005LocalDeploymentReadinessIo, "readText" | "fileExists">;
}): boolean {
  let publicConfig: unknown;
  try {
    publicConfig = JSON.parse(input.io.readText(input.publicConfigPath));
  } catch {
    return false;
  }
  if (JSON.stringify(publicConfig) !== JSON.stringify(buildCadencePublicWebConfig(input.config))) return false;

  const indexPath = join(input.webDistPath, "index.html");
  if (!input.io.fileExists(indexPath)) return false;
  let html: string;
  try {
    html = input.io.readText(indexPath);
  } catch {
    return false;
  }
  const references = extractScriptAndStylesheetReferences(html);
  if (!references || references.length === 0) return false;
  return references.every((reference) => isExistingLocalAsset(reference, input.webDistPath, input.io));
}

function extractScriptAndStylesheetReferences(html: string): readonly string[] | undefined {
  const references: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const source = readAttribute(match[0], "src");
    if (source !== undefined) references.push(source);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const relation = readAttribute(match[0], "rel");
    if (relation?.toLowerCase().split(/\s+/).includes("stylesheet")) {
      const href = readAttribute(match[0], "href");
      if (href === undefined) return undefined;
      references.push(href);
    }
  }
  return references;
}

function readAttribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

function isExistingLocalAsset(
  reference: string,
  webDistPath: string,
  io: Pick<Vs005LocalDeploymentReadinessIo, "fileExists">,
): boolean {
  if (!reference.startsWith("/assets/") || reference.includes("\\") || /[?#]/.test(reference)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    return false;
  }
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) return false;
  const dist = resolve(webDistPath);
  const asset = resolve(dist, `.${decoded}`);
  const pathFromDist = relative(dist, asset);
  if (!pathFromDist || pathFromDist.startsWith(`..${sep}`) || pathFromDist === ".." || isAbsolute(pathFromDist)) return false;
  return io.fileExists(asset);
}
