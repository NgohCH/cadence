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


const migration =
  readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/20260828144000_r02e_browser_database_boundary.sql"
    ),
    "utf8"
  );


test(
  "R02E removes the browser RLS authorization layer",
  () => {
    const policyDrops =
      migration.match(
        /drop policy if exists/g
      ) ?? [];


    assert.equal(
      policyDrops.length,
      27
    );


    for (const token of [
      "ai_proposals_select_agent_users",
      "audit_events_select_authorized",
      "memberships_select_project_member",
      "permissions_select_authenticated",
      "role_permissions_select_authenticated",
      "roles_select_authenticated",
      "projects_select_member",
      "users_select_visible",
    ]) {
      assert.ok(
        migration.includes(token),
        `Expected policy retirement missing: ${token}`
      );
    }
  }
);


test(
  "R02E removes existing browser relation authority and public schema usage",
  () => {
    assert.match(
      migration,
      /revoke all privileges\s+on all tables in schema public\s+from anon, authenticated;/i
    );

    assert.match(
      migration,
      /revoke all privileges\s+on all sequences in schema public\s+from anon, authenticated;/i
    );

    assert.match(
      migration,
      /revoke usage\s+on schema public\s+from public, anon, authenticated;/i
    );

    assert.match(
      migration,
      /grant usage\s+on schema public\s+to service_role;/i
    );
  }
);


test(
  "R02E prevents postgres migrations from recreating browser grants",
  () => {
    assert.match(
      migration,
      /alter default privileges\s+for role postgres\s+in schema public\s+revoke all privileges\s+on tables\s+from public, anon, authenticated;/i
    );

    assert.match(
      migration,
      /alter default privileges\s+for role postgres\s+in schema public\s+revoke all privileges\s+on sequences\s+from public, anon, authenticated;/i
    );

    assert.match(
      migration,
      /alter default privileges\s+for role postgres\s+in schema public\s+revoke execute\s+on functions\s+from public, anon, authenticated;/i
    );


    /*
     * Supabase-managed platform defaults are deliberately not changed.
     */
    assert.doesNotMatch(
      migration,
      /alter default privileges\s+for role supabase_admin/i
    );
  }
);


test(
  "R02E retires the legacy database authorization helpers",
  () => {
    for (const token of [
      "public.can_access_decision(uuid, uuid)",
      "public.can_access_file(uuid, uuid)",
      "public.can_access_message(uuid, uuid)",
      "public.can_view_user(uuid, uuid)",
      "public.has_project_permission(uuid, text, uuid)",
      "public.is_project_member(uuid, uuid)",
      "public.has_platform_permission(text, uuid)",
      "public.current_app_user_id()",
    ]) {
      assert.ok(
        migration.includes(
          `drop function if exists\n  ${token}`
        ),
        `Legacy helper retirement missing: ${token}`
      );
    }


    assert.doesNotMatch(
      migration,
      /drop function[\s\S]*cascade;/i
    );
  }
);


test(
  "R02E removes browser execution from Cadence internal functions",
  () => {
    for (const token of [
      "public.enforce_platform_role_scope()",
      "public.enforce_project_role_scope()",
      "public.enforce_protected_role_membership_continuity()",
      "public.fan_out_domain_event()",
      "public.prevent_hard_delete()",
      "public.prevent_immutable_mutation()",
      "public.prevent_membership_termination_rewrite()",
      "public.prevent_project_role_transfer_update()",
      "public.touch_updated_at()",
    ]) {
      assert.ok(
        migration.includes(token),
        `Cadence function boundary missing: ${token}`
      );
    }


    assert.match(
      migration,
      /from public, anon, authenticated;/i
    );
  }
);


test(
  "R02E contains dependency guards and live postconditions",
  () => {
    for (const token of [
      "R02E_LEGACY_AUTH_FUNCTION_DEPENDENCY_REMAINS",
      "R02E_LEGACY_AUTH_POLICY_DEPENDENCY_REMAINS",
      "R02E_BROWSER_RLS_POLICY_REMAINS",
      "R02E_BROWSER_RELATION_GRANT_REMAINS",
      "R02E_BROWSER_FUNCTION_EXECUTE_REMAINS",
      "R02E_BROWSER_DEFAULT_PRIVILEGE_REMAINS",
      "R02E_ANON_PUBLIC_SCHEMA_USAGE_REMAINS",
      "R02E_AUTHENTICATED_PUBLIC_SCHEMA_USAGE_REMAINS",
      "R02E_SERVICE_ROLE_PUBLIC_SCHEMA_USAGE_MISSING",
    ]) {
      assert.ok(
        migration.includes(token),
        `Migration postcondition missing: ${token}`
      );
    }


    assert.match(
      migration,
      /has_function_privilege\([\s\S]*'anon'[\s\S]*'EXECUTE'/i
    );

    assert.match(
      migration,
      /has_schema_privilege\([\s\S]*'service_role'[\s\S]*'public'[\s\S]*'USAGE'/i
    );
  }
);