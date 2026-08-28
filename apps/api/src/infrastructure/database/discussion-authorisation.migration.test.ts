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
    "../../supabase/migrations/20260827220000_r02e_discussion_authorisation_cutover.sql"
  );


const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );


test(
  "R02E Discussion RPC contains no project permission decision",
  () => {
    assert.match(
      migration,
      /create or replace function public\.post_discussion_message/
    );

    assert.doesNotMatch(
      migration,
      /has_project_permission/i
    );

    assert.doesNotMatch(
      migration,
      /is_project_member/i
    );

    assert.doesNotMatch(
      migration,
      /project_memberships|project_role_assignments|role_permissions/i
    );
  }
);


test(
  "R02E Discussion RPC preserves persistence validation and provenance",
  () => {
    assert.match(
      migration,
      /DISCUSSION_CONTENT_REQUIRED/
    );

    assert.match(
      migration,
      /DISCUSSION_CONTENT_TOO_LONG/
    );

    assert.match(
      migration,
      /DISCUSSION_PARENT_MESSAGE_NOT_FOUND/
    );

    assert.match(
      migration,
      /insert into public\.messages/
    );

    assert.match(
      migration,
      /insert into public\.message_versions/
    );

    assert.match(
      migration,
      /insert into public\.domain_events/
    );

    assert.match(
      migration,
      /'MessageCreated'/
    );

    assert.match(
      migration,
      /p_correlation_id/
    );

    assert.match(
      migration,
      /p_causation_id/
    );
  }
);


test(
  "R02E Discussion RPC remains security-definer service-role-only",
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
      /revoke all on function public\.post_discussion_message\([\s\S]*?\)\s*from public;/
    );

    assert.match(
      migration,
      /revoke all on function public\.post_discussion_message\([\s\S]*?\)\s*from anon, authenticated;/
    );

    assert.match(
      migration,
      /grant execute on function public\.post_discussion_message\([\s\S]*?\)\s*to service_role;/
    );
  }
);
