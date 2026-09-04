import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const workerSource = readFileSync(
  resolve(process.cwd(), "src/worker.ts"),
  "utf8"
);

const serverSource = readFileSync(
  resolve(process.cwd(), "src/server.ts"),
  "utf8"
);


test("worker is a one-shot adapter for the bounded runtime-neutral cycle", () => {
  assert.match(workerSource, /runCadenceWorkerCycle/);
  assert.match(workerSource, /createCadenceWorkerServices/);
  assert.doesNotMatch(workerSource, /processNext/);
  assert.doesNotMatch(workerSource, /processDueMemberships/);
});


test("API startup does not invoke expiry processing", () => {
  assert.doesNotMatch(
    serverSource,
    /ProjectMembershipExpiryProcessor|processDueMemberships/
  );
});
