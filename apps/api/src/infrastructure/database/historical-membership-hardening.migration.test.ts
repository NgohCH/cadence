import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";


const migration = readFileSync(
  resolve(
    __dirname,
    "../../../../../supabase/migrations/20260828190000_r03d_historical_mutation_hardening.sql"
  ),
  "utf8"
);


test(
  "R03D retains every legacy membership column",
  () => {
    for (const column of [
      "user_id",
      "role_id",
      "joined_at",
      "status",
      "created_by",
    ]) {
      assert.ok(migration.includes(`'${column}'`));
    }

    assert.doesNotMatch(migration, /drop\s+column/i);
  }
);


test(
  "R03D freezes membership identity and permits only forward lifecycle closure",
  () => {
    for (const token of [
      "PROJECT_MEMBERSHIP_IDENTITY_PROVENANCE_IMMUTABLE",
      "PROJECT_MEMBERSHIP_HISTORY_IMMUTABLE",
      "PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_REQUIRED",
      "PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_INVALID",
      "project_memberships_enforce_history_immutability",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);


test(
  "R03D makes closed assignments append-only and protects transfer agreement",
  () => {
    for (const token of [
      "PROJECT_ROLE_ASSIGNMENT_HISTORY_IMMUTABLE",
      "PROJECT_ROLE_ASSIGNMENT_FORWARD_CLOSE_REQUIRED",
      "PROJECT_ROLE_PROTECTED_TRANSFER_HISTORY_DIVERGED",
      "project_role_assignments_enforce_history_immutability",
      "assert_protected_assignment_transfer",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);


test(
  "R03D removes destructive cascade and service-role history paths",
  () => {
    assert.match(
      migration,
      /project_memberships_project_id_fkey[\s\S]*on delete restrict/i
    );
    assert.match(
      migration,
      /project_memberships_created_by_fkey[\s\S]*on delete restrict/i
    );

    for (const token of [
      "HISTORICAL_MEMBERSHIP_TRUNCATE_FORBIDDEN",
      "project_memberships_prevent_truncate",
      "project_role_assignments_prevent_truncate",
      "project_role_transfers_prevent_truncate",
      "revoke update, delete, truncate on table public.project_memberships",
      "revoke update, delete, truncate on table public.project_role_assignments",
      "revoke update, delete, truncate on table public.project_role_transfers",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);
