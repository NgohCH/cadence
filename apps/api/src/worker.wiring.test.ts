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


test("worker constructs and invokes the membership expiry processor", () => {
  assert.match(
    workerSource,
    /new SupabaseProjectMembershipLifecycleRepository\(\s*databaseClient\s*\)/
  );
  assert.match(
    workerSource,
    /new ProjectMembershipExpiryProcessor\(\s*projectMembershipLifecycleRepository\s*\)/
  );
  assert.match(
    workerSource,
    /membershipExpiryProcessor[\s\S]*\.processDueMemberships\(\)/
  );
});


test("API startup does not invoke expiry processing", () => {
  assert.doesNotMatch(
    serverSource,
    /ProjectMembershipExpiryProcessor|processDueMemberships/
  );
});
