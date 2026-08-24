import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const serverSource = readFileSync(
  resolve(
    process.cwd(),
    "src/server.ts"
  ),
  "utf8"
);


test(
  "production composition injects role-management and membership-lifecycle boundaries",
  () => {
    assert.match(
      serverSource,
      /new SupabaseProjectRoleManagementRepository\(\s*databaseClient\s*\)/
    );

    assert.match(
      serverSource,
      /new SupabaseProjectMembershipLifecycleRepository\(\s*databaseClient\s*\)/
    );
    assert.match(
      serverSource,
      /new SupabaseTasksMembershipResponsibilityRepository\(\s*databaseClient\s*\)/
    );
    assert.match(
      serverSource,
      /new DefaultTasksMembershipResponsibilityService\(\s*tasksMembershipResponsibilityRepository\s*\)/
    );
    assert.match(
      serverSource,
      /new SupabaseProjectLifecycleRepository\(\s*databaseClient\s*\)/
    );
    assert.match(
      serverSource,
      /new DefaultProjectsMembershipLifecycleService\(\s*projectLifecycleRepository\s*\)/
    );
    assert.match(
      serverSource,
      /new ProjectMembershipService\([\s\S]*projectRoleManagementRepository,[\s\S]*repository:\s*projectMembershipLifecycleRepository,[\s\S]*projects:\s*projectsMembershipLifecycleService,[\s\S]*tasks:\s*tasksMembershipResponsibilityService/
    );
  }
);
