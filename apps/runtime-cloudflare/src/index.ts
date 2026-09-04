import { createServer } from "node:http";

import {
  fingerprintCadenceRuntimeConfig,
  resolveCadenceSecrets,
  validateCadenceRuntimeConfig,
  type CadenceResolvedSecrets,
  type CadenceRuntimeConfig,
} from "../../api/src/bootstrap/cadence-config";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../../api/src/bootstrap/cadence-release";
import {
  createCadenceApp,
  type CadenceAppRuntime,
} from "../../api/src/runtime/create-cadence-app";
import { runCadenceWorkerCycle } from "../../api/src/runtime/cadence-worker-cycle";
import { createCadenceWorkerServices } from "../../api/src/runtime/create-cadence-worker-services";
import { httpServerHandler } from "cloudflare:node";

interface Env {
  CADENCE_RUNTIME_CONFIG_JSON: string;
  CADENCE_CONFIG_FINGERPRINT: string;
  CADENCE_RELEASE_VERSION: string;
  CADENCE_COMMIT_SHA: string;
  CADENCE_BUILD_ID: string;
  SUPABASE_SECRET_KEY: string;
}

type CloudflareHttpHandler = ReturnType<
  typeof httpServerHandler
>;
type CloudflareHttpRequest = Parameters<
  NonNullable<CloudflareHttpHandler["fetch"]>
>[0];
type CloudflareExecutionContext = Parameters<
  NonNullable<CloudflareHttpHandler["fetch"]>
>[2];

function buildCloudflareCadenceRuntime(env: Env): CadenceAppRuntime {
  const config = loadCloudflareConfig(env);
  const secrets = resolveCloudflareSecrets(config, env);
  const release = loadCloudflareRelease(env);

  return {
    config,
    secrets,
    release,
  };
}

function buildCloudflareWorkerInput(
  env: Env,
): Parameters<typeof runCadenceWorkerCycle>[0] {
  const runtime = buildCloudflareCadenceRuntime(env);

  return {
    config: runtime.config,
    release: runtime.release,
    runtime: "cloudflare",
    servicesFactory: () =>
      createCadenceWorkerServices({
        config: runtime.config,
        secrets: runtime.secrets,
      }),
  };
}

function loadCloudflareConfig(env: Env): CadenceRuntimeConfig {
  const config = validateCadenceRuntimeConfig(
    JSON.parse(env.CADENCE_RUNTIME_CONFIG_JSON),
  );
  const fingerprint = fingerprintCadenceRuntimeConfig(config);

  if (fingerprint !== env.CADENCE_CONFIG_FINGERPRINT) {
    throw new Error(
      "Cadence runtime configuration fingerprint mismatch.",
    );
  }

  return config;
}

function resolveCloudflareSecrets(
  config: CadenceRuntimeConfig,
  env: Env,
): CadenceResolvedSecrets {
  return resolveCadenceSecrets(config, {
    [config.supabase.secretKeySecretRef]: env.SUPABASE_SECRET_KEY,
  });
}

function loadCloudflareRelease(env: Env): CadenceReleaseIdentity {
  return loadCadenceReleaseIdentity({
    version: env.CADENCE_RELEASE_VERSION,
    commitSha: env.CADENCE_COMMIT_SHA,
    buildId: env.CADENCE_BUILD_ID,
  });
}

let started = false;
let httpHandler: ReturnType<typeof httpServerHandler> | undefined;

function ensureHttpRuntime(env: Env): void {
  if (started) {
    return;
  }

  const runtime = buildCloudflareCadenceRuntime(env);
  const server = createServer(createCadenceApp(runtime));
  server.listen(3000);
  httpHandler = httpServerHandler(3000);
  started = true;
}

export default {
  async fetch(
    request: CloudflareHttpRequest,
    env: Env,
    ctx: CloudflareExecutionContext,
  ): Promise<Response> {
    ensureHttpRuntime(env);
    const handler = httpHandler?.fetch;

    if (!handler) {
      throw new Error("Cloudflare Node HTTP handler is unavailable.");
    }

    return handler(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    controller.noRetry();
    const result = await runCadenceWorkerCycle(
      buildCloudflareWorkerInput(env),
    );

    console.log(JSON.stringify(result));

    if (result.outcome !== "SUCCESS") {
      throw new Error(`Cadence worker cycle ${result.outcome}`);
    }
  },
};
