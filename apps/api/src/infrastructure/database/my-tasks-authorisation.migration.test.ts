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
    "../../supabase/migrations/20260827214500_r02e_my_tasks_authorisation_cutover.sql"
  );


const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );


test(
  "R02E My Tasks RPC performs data scoping without project authorization",
  () => {
    assert.match(
      migration,
      /create or replace function public\.list_my_tasks\(\s*p_user_id uuid\s*\)/
    );

    assert.match(
      migration,
      /where t\.assigned_to\s*=\s*p_user_id/
    );

    assert.match(
      migration,
      /t\.status in \(\s*'open',\s*'in_progress'\s*\)/
    );

    assert.match(
      migration,
      /t\.due_date asc nulls last,[\s\S]*t\.created_at desc,[\s\S]*t\.id asc/
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
  "R02E My Tasks RPC remains service-role-only",
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
      /revoke all on function public\.list_my_tasks\(uuid\)\s+from public;/
    );

    assert.match(
      migration,
      /revoke all on function public\.list_my_tasks\(uuid\)\s+from anon, authenticated;/
    );

    assert.match(
      migration,
      /grant execute on function public\.list_my_tasks\(uuid\)\s+to service_role;/
    );

    assert.doesNotMatch(
      migration,
      /grant execute on function public\.list_my_tasks\(uuid\)[\s\S]*to (anon|authenticated)/
    );
  }
);


test(
  "R02E My Tasks cutover does not redefine legacy authorization helpers",
  () => {
    assert.doesNotMatch(
      migration,
      /create\s+(?:or replace\s+)?function\s+public\.has_project_permission/i
    );

    assert.doesNotMatch(
      migration,
      /create\s+(?:or replace\s+)?function\s+public\.is_project_member/i
    );
  }
);
