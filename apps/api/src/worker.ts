import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
} from "./bootstrap/cadence-config";
import { loadCadenceReleaseIdentity } from "./bootstrap/cadence-release";
import { runCadenceWorkerCycle } from "./runtime/cadence-worker-cycle";
import { createCadenceWorkerServices } from "./runtime/create-cadence-worker-services";

async function main(): Promise<void> {
  const configPath = resolveCadenceConfigPath({
    argv: process.argv,
    environment: process.env,
  });
  const config = loadCadenceRuntimeConfig(configPath);
  const secrets = resolveCadenceSecrets(config, process.env);
  const release = loadCadenceReleaseIdentity({
    version: process.env.CADENCE_RELEASE_VERSION,
    commitSha: process.env.CADENCE_COMMIT_SHA,
    buildId: process.env.CADENCE_BUILD_ID,
  });
  const result = await runCadenceWorkerCycle({
    config,
    release,
    runtime: "node",
    servicesFactory: () => createCadenceWorkerServices({ config, secrets }),
  });

  console.log(JSON.stringify(result));

  if (result.outcome !== "SUCCESS") {
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error(JSON.stringify({
    artifactType: "cadence.vs005.worker-bootstrap-failure",
    formatVersion: 1,
    code: "WORKER_BOOTSTRAP_FAILED",
  }));
  process.exitCode = 1;
});
