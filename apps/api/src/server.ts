import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
} from "./bootstrap/cadence-config";
import { loadCadenceReleaseIdentity } from "./bootstrap/cadence-release";
import { createCadenceApp } from "./runtime/create-cadence-app";

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
const app = createCadenceApp({ config, secrets, release });
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Cadence API listening on ${port}`);
});
