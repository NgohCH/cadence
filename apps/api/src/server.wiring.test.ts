import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const serverSource = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
const runtimeSource = readFileSync(
  resolve(process.cwd(), "src/runtime/create-cadence-app.ts"),
  "utf8",
);

test("runtime-neutral composition preserves governed repository and service wiring", () => {
  assert.match(runtimeSource, /new SupabaseProjectRoleManagementRepository\(\s*databaseClient\s*\)/);
  assert.match(runtimeSource, /new SupabaseProjectMembershipLifecycleRepository\(\s*databaseClient\s*\)/);
  assert.match(runtimeSource, /new SupabaseTasksMembershipResponsibilityRepository\(\s*databaseClient\s*\)/);
  assert.match(runtimeSource, /new DefaultTasksMembershipResponsibilityService\(\s*tasksMembershipResponsibilityRepository\s*\)/);
  assert.match(runtimeSource, /new SupabaseProjectLifecycleRepository\(\s*databaseClient\s*\)/);
  assert.match(runtimeSource, /new DefaultProjectsMembershipLifecycleService\(\s*projectLifecycleRepository\s*\)/);
  assert.match(runtimeSource, /new ProjectMembershipService\([\s\S]*projectRoleManagementRepository,[\s\S]*repository:\s*projectMembershipLifecycleRepository,[\s\S]*projects:\s*projectsMembershipLifecycleService,[\s\S]*tasks:\s*tasksMembershipResponsibilityService/);
});

test("server is an adapter and no longer constructs module repositories or services", () => {
  assert.doesNotMatch(serverSource, /new Supabase(?:AuthProvider|[A-Z])/);
  assert.doesNotMatch(serverSource, /new (?:Identity|Projects|ProjectMembership|Discussion|Tasks|TeamAgent)/);
  assert.match(serverSource, /createCadenceApp\(/);
});
