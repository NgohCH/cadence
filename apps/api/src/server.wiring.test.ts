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
  "production composition injects the Supabase role-management repository",
  () => {
    assert.match(
      serverSource,
      /new SupabaseProjectRoleManagementRepository\(\s*databaseClient\s*\)/
    );

    assert.match(
      serverSource,
      /new ProjectMembershipService\([\s\S]*projectMemberAdmissionRepository,[\s\S]*identityPersistenceRepository,[\s\S]*projectRoleManagementRepository\s*\)/
    );
  }
);
