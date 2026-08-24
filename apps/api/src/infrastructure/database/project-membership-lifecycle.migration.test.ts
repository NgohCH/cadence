import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260824120000_vs002_membership_lifecycle.sql"
  ),
  "utf8"
);

const executableMigration = migration
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");


function functionBody(name: string): string {
  const body = migration.match(
    new RegExp(
      `create or replace function public\\.${name}[\\s\\S]*?end;\\s*\\$\\$;`
    )
  )?.[0];

  assert.ok(body, `${name} must exist`);
  return body;
}


test(
  "termination provenance permits legacy nulls and distinguishes actor-backed removal from system expiry",
  () => {
    assert.match(migration, /add column termination_kind text/);
    assert.match(migration, /add column terminated_by_person_id uuid[\s\S]*references public\.persons\(id\) on delete restrict/);
    assert.match(migration, /add column termination_correlation_id uuid/);
    assert.match(migration, /add column terminated_at timestamptz/);
    assert.match(migration, /termination_kind is null[\s\S]*terminated_by_person_id is null[\s\S]*termination_correlation_id is null[\s\S]*terminated_at is null/);
    assert.match(migration, /termination_kind = 'ADMINISTRATIVE_REMOVAL'[\s\S]*terminated_by_person_id is not null/);
    assert.match(migration, /termination_kind = 'EXPIRY'[\s\S]*terminated_by_person_id is null/);
  }
);


test(
  "administrative termination locks project then membership and validates lifecycle state",
  () => {
    const body = functionBody("terminate_project_membership");
    const projectLock = body.indexOf("from public.projects as project");
    const membershipLock = body.indexOf("from public.project_memberships as membership");

    assert.ok(projectLock >= 0 && projectLock < membershipLock);
    assert.match(body, /from public\.projects as project[\s\S]*for update/);
    assert.match(body, /from public\.project_memberships as membership[\s\S]*for update/);
    assert.match(body, /v_membership\.project_id <> p_project_id[\s\S]*PROJECT_MEMBERSHIP_PROJECT_MISMATCH/);
    assert.match(body, /v_project\.lifecycle_status in \([\s\S]*'completed',[\s\S]*'cancelled'[\s\S]*MEMBER_REMOVAL_NOT_PERMITTED/);
  }
);


test(
  "administrative termination enforces Owner and operational Manager continuity but not Sponsor continuity",
  () => {
    const body = functionBody("terminate_project_membership");

    assert.match(body, /assignment\.role = 'PROJECT_OWNER'[\s\S]*LAST_REQUIRED_ROLE_HOLDER/);
    assert.match(body, /v_project\.lifecycle_status in \([\s\S]*'active',[\s\S]*'on_hold'[\s\S]*assignment\.role = 'PROJECT_MANAGER'[\s\S]*LAST_REQUIRED_ROLE_HOLDER/);
    assert.doesNotMatch(body, /assignment\.role = 'PROJECT_SPONSOR'/);
  }
);


test(
  "termination closes every effective assignment and membership together without deleting history",
  () => {
    const body = functionBody("terminate_project_membership");

    assert.match(body, /update public\.project_role_assignments[\s\S]*set effective_to = p_effective_at/);
    assert.match(body, /update public\.project_memberships[\s\S]*effective_to = p_effective_at[\s\S]*termination_kind = 'ADMINISTRATIVE_REMOVAL'/);
    assert.doesNotMatch(executableMigration, /delete\s+from\s+public\.(project_memberships|project_role_assignments)/i);
    assert.doesNotMatch(executableMigration, /insert\s+into\s+public\.domain_events/i);
    assert.doesNotMatch(body, /public\.tasks|task_status|assigned_to/i);
  }
);


test(
  "recorded termination provenance cannot be rewritten",
  () => {
    const body = functionBody("prevent_membership_termination_rewrite");

    assert.match(body, /old\.termination_kind is not null/);
    assert.match(body, /new\.status,[\s\S]*new\.effective_to,[\s\S]*new\.termination_kind,[\s\S]*new\.terminated_by_person_id,[\s\S]*new\.termination_reason,[\s\S]*new\.termination_correlation_id,[\s\S]*new\.terminated_at/);
    assert.match(body, /PROJECT_MEMBERSHIP_TERMINATION_HISTORY_IMMUTABLE/);
    assert.match(migration, /create trigger project_memberships_prevent_termination_rewrite[\s\S]*before update on public\.project_memberships/);
  }
);


test(
  "administrative retry preserves the original transition and provenance",
  () => {
    const body = functionBody("terminate_project_membership");

    assert.match(body, /termination_kind = 'ADMINISTRATIVE_REMOVAL'[\s\S]*termination_correlation_id = p_correlation_id[\s\S]*'ALREADY_ENDED'/);
    assert.match(body, /project_membership_role_history_at\([\s\S]*v_membership\.effective_to/);
  }
);


test(
  "expiry materialisation preserves the original boundary and system provenance idempotently",
  () => {
    const body = functionBody("finalize_project_membership_expiry");

    assert.match(body, /membership_status = 'ENDED'[\s\S]*termination_kind is not null[\s\S]*'ALREADY_ENDED'/);
    assert.match(body, /p_finalized_at < v_membership\.effective_to[\s\S]*PROJECT_MEMBERSHIP_NOT_EXPIRED/);
    assert.match(body, /set effective_to = v_membership\.effective_to/);
    assert.match(body, /termination_kind = 'EXPIRY',[\s\S]*terminated_by_person_id = null,[\s\S]*terminated_at = p_finalized_at/);
    assert.doesNotMatch(body, /effective_to = p_finalized_at/);
    assert.match(body, /assignment\.role in \([\s\S]*'PROJECT_OWNER',[\s\S]*'PROJECT_MANAGER'[\s\S]*LAST_REQUIRED_ROLE_HOLDER/);
  }
);


test(
  "future Owner and Manager writes require unbounded membership while Sponsor may remain bounded",
  () => {
    const body = functionBody("enforce_protected_role_membership_continuity");

    assert.match(body, /new\.role not in \([\s\S]*'PROJECT_OWNER',[\s\S]*'PROJECT_MANAGER'/);
    assert.match(body, /v_membership_effective_to is not null[\s\S]*PROJECT_ROLE_BOUNDED_MEMBERSHIP_REQUIRES_CONTINUITY/);
    assert.doesNotMatch(body, /PROJECT_SPONSOR/);
    assert.match(migration, /before insert or update of role, membership_id, project_id/);
  }
);


test(
  "bounded protected-holder detection is read-only and limited to effective Owner and Manager violations",
  () => {
    const body = migration.match(
      /create or replace function public\.list_bounded_protected_role_violations[\s\S]*?\$\$;/
    )?.[0];

    assert.ok(body);
    assert.match(body, /language sql[\s\S]*stable/);
    assert.match(body, /membership\.effective_to is not null/);
    assert.match(body, /assignment\.role in \([\s\S]*'PROJECT_OWNER',[\s\S]*'PROJECT_MANAGER'/);
    assert.match(body, /assignment\.effective_from < membership\.effective_to/);
    assert.match(body, /membership\.effective_to < assignment\.effective_to/);
    assert.doesNotMatch(body, /PROJECT_SPONSOR/);
    assert.doesNotMatch(body, /\b(update|insert|delete)\b/i);
  }
);


test(
  "lifecycle RPCs are security-definer service-role only",
  () => {
    for (const name of [
      "terminate_project_membership",
      "finalize_project_membership_expiry",
      "list_bounded_protected_role_violations",
    ]) {
      assert.match(migration, new RegExp(`function public\\.${name}\\([\\s\\S]*security definer[\\s\\S]*set search_path = public, pg_temp`));
      assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*from public, anon, authenticated`));
      assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*to service_role`));
    }
  }
);
