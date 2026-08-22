import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  test,
} from "node:test";


const migrationPath =
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260821144400_vs002_member_admission.sql"
  );

const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );

const executableMigration =
  migration
    .replace(
      /--.*$/gm,
      ""
    )
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );

test(
  "VS002-04 admission creates membership and initial role atomically",
  () => {
    assert.match(
      migration,
      /create or replace function public\.add_project_member/
    );

    assert.match(
      migration,
      /insert into public\.project_memberships/
    );

    assert.match(
      migration,
      /insert into public\.project_role_assignments/
    );

    assert.match(
      migration,
      /'PROJECT_MEMBER'/
    );

    assert.doesNotMatch(
      migration,
      /insert into public\.domain_events/,
      "Membership events remain VS002-07 scope."
    );
  }
);


test(
  "VS002-04 admission serializes duplicate checks by stable Person",
  () => {
    assert.match(
      migration,
      /from public\.persons as target_person[\s\S]*for update/
    );

    assert.match(
      migration,
      /PROJECT_MEMBERSHIP_ALREADY_ACTIVE/
    );

    assert.match(
      migration,
      /existing_membership\.effective_from\s*<[\s\S]*coalesce\([\s\S]*p_effective_to[\s\S]*'infinity'::timestamptz/
    );

    assert.match(
      migration,
      /p_effective_from\s*<[\s\S]*coalesce\([\s\S]*existing_membership\.effective_to[\s\S]*'infinity'::timestamptz/
    );
  }
);


test(
  "VS002-04 admission does not reuse legacy VS001 permission persistence",
  () => {
    assert.doesNotMatch(
      executableMigration,
      /has_project_permission\s*\(/
    );

    assert.match(
      executableMigration,
      /user_id,[\s\S]*role_id,[\s\S]*status,[\s\S]*joined_at/
    );

    assert.match(
      executableMigration,
      /p_membership_id,[\s\S]*p_project_id,[\s\S]*null,[\s\S]*null,[\s\S]*'active'/
    );
  }
);


test(
  "VS002-04 admission RPC is restricted to service role",
  () => {
    assert.match(
      migration,
      /security definer/
    );

    assert.match(
      migration,
      /set search_path = public, pg_temp/
    );

    assert.match(
      migration,
      /revoke all on function public\.add_project_member\([\s\S]*from public;/
    );

    assert.match(
      migration,
      /revoke all on function public\.add_project_member\([\s\S]*from anon;/
    );

    assert.match(
      migration,
      /revoke all on function public\.add_project_member\([\s\S]*from authenticated;/
    );

    assert.match(
      migration,
      /grant execute on function public\.add_project_member\([\s\S]*to service_role;/
    );
  }
);