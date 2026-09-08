import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";

export interface GeneratedCloudflareDeployment {
  wrangler: {
    account_id: string;
    name: string;
    main: string;
    compatibility_date: "2026-09-04";
    compatibility_flags: readonly ["nodejs_compat"];
    assets: {
      directory: "../web/dist";
      binding: "ASSETS";
      run_worker_first: readonly ["/api/*", "/health"];
      not_found_handling: "single-page-application";
    };
    triggers: {
      crons: readonly string[];
    };
    secrets: {
      required: readonly string[];
    };
    workers_dev: boolean;
    routes?: readonly [{
      pattern: string;
      custom_domain: true;
    }];
    vars: {
      CADENCE_RUNTIME_CONFIG_JSON: string;
      CADENCE_CONFIG_FINGERPRINT: string;
      CADENCE_RELEASE_VERSION: string;
      CADENCE_COMMIT_SHA: string;
      CADENCE_BUILD_ID: string;
    };
  };
}

export function buildCloudflareDeployment(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
}): GeneratedCloudflareDeployment {
  if (input.config.runtime.provider !== "cloudflare") {
    throw new Error(
      "Cloudflare deployment requires the cloudflare runtime provider.",
    );
  }

  const cloudflare = input.config.cloudflare;
  if (!cloudflare) {
    throw new Error(
      "Cloudflare deployment requires an explicit Cloudflare target.",
    );
  }

  const publicUrl = new URL(input.config.application.publicUrl);
  if (publicUrl.protocol !== "https:") {
    throw new Error(
      "Cloudflare deployment requires an HTTPS public origin.",
    );
  }

  const workersDev = publicUrl.hostname.endsWith(".workers.dev");
  const deployment: GeneratedCloudflareDeployment = {
    wrangler: {
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
      triggers: {
        crons: [input.config.worker.schedule],
      },
      secrets: {
        required: [input.config.supabase.secretKeySecretRef],
      },
      workers_dev: workersDev,
      vars: {
        CADENCE_RUNTIME_CONFIG_JSON: JSON.stringify(input.config),
        CADENCE_CONFIG_FINGERPRINT:
          fingerprintCadenceRuntimeConfig(input.config),
        CADENCE_RELEASE_VERSION: input.release.version,
        CADENCE_COMMIT_SHA: input.release.commitSha,
        CADENCE_BUILD_ID: input.release.buildId,
      },
    },
  };

  if (!workersDev) {
    deployment.wrangler.routes = [{
      pattern: publicUrl.hostname,
      custom_domain: true,
    }];
  }

  return deployment;
}

function parseArguments(args: readonly string[]): {
  configPath: string;
  outPath: string;
  releaseVersion: string;
  commitSha: string;
  buildId: string;
} {
  let configPath: string | undefined;
  let outPath: string | undefined;
  let releaseVersion: string | undefined;
  let commitSha: string | undefined;
  let buildId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (argument === "--out" && value) {
      outPath = value;
      index += 1;
    } else if (argument === "--release-version" && value) {
      releaseVersion = value;
      index += 1;
    } else if (argument === "--commit-sha" && value) {
      commitSha = value;
      index += 1;
    } else if (argument === "--build-id" && value) {
      buildId = value;
      index += 1;
    } else {
      throw new Error(
        "Usage: vs005-generate-deployment.ts --config <path> --out <path> --release-version <value> --commit-sha <40-hex> --build-id <value>",
      );
    }
  }

  if (!configPath || !outPath || !releaseVersion || !commitSha || !buildId) {
    throw new Error(
      "Usage: vs005-generate-deployment.ts --config <path> --out <path> --release-version <value> --commit-sha <40-hex> --build-id <value>",
    );
  }

  return {
    configPath,
    outPath,
    releaseVersion,
    commitSha,
    buildId,
  };
}

export function writeCloudflareDeployment(
  deployment: GeneratedCloudflareDeployment,
  outPath: string,
): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(deployment.wrangler, null, 2)}\n`,
    "utf8",
  );
}

export function runCloudflareDeploymentGenerator(
  args: readonly string[],
): void {
  const {
    configPath,
    outPath,
    releaseVersion,
    commitSha,
    buildId,
  } = parseArguments(args);
  const config = loadCadenceRuntimeConfig(configPath);
  const release = loadCadenceReleaseIdentity({
    version: releaseVersion,
    commitSha,
    buildId,
  });

  writeCloudflareDeployment(
    buildCloudflareDeployment({ config, release }),
    outPath,
  );
}

if (require.main === module) {
  runCloudflareDeploymentGenerator(process.argv.slice(2));
}
