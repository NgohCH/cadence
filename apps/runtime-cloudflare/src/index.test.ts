import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/index.ts"),
  "utf8",
);

test("final adapter uses portable API and worker composition", () => {
  for (const symbol of [
    "createCadenceApp",
    "httpServerHandler",
    "runCadenceWorkerCycle",
    "createCadenceWorkerServices",
    "controller.noRetry()",
    "validateCadenceRuntimeConfig",
    "fingerprintCadenceRuntimeConfig",
    "loadCadenceReleaseIdentity",
  ]) {
    assert.match(source, new RegExp(symbol.replace(/[.()]/g, "\\$&")));
  }

  assert.doesNotMatch(source, /handleAsNodeRequest/);
  assert.doesNotMatch(source, /from\s+["'].*modules\/.*service/);
  assert.doesNotMatch(
    source,
    /DurableObject|durable_objects|d1_databases|kv_namespaces|queues/,
  );
  assert.doesNotMatch(source, /\.\.\/\.\.\/api\/src\/server/);
  assert.doesNotMatch(source, /\.\.\/\.\.\/api\/src\/worker/);
  assert.doesNotMatch(source, /process\.env/);
});
