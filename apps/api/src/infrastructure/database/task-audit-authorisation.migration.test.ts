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
      "../../supabase/migrations/20260828141500_r02e_audit_authorisation_cutover.sql"
    ),
    "utf8"
  );


test(
  "Audit persistence contains no project authorization decision",
  () => {
    for (const token of [
      "p_requesting_user_id",
      "has_project_permission",
      "'audit.view'",
      "AUDIT_VIEW_PERMISSION_DENIED",
    ]) {
      assert.ok(
        !migration.includes(token),
        `Legacy authorization token remains: ${token}`
      );
    }
  }
);


test(
  "Audit persistence replaces the three-argument RPC",
  () => {
    assert.match(
      migration,
      /drop function if exists public\.get_task_audit_journey\(\s*uuid,\s*uuid,\s*uuid\s*\);/
    );

    assert.match(
      migration,
      /create or replace function public\.get_task_audit_journey\(\s*p_project_id uuid,\s*p_task_id uuid\s*\)/
    );
  }
);


test(
  "Audit persistence preserves reconstruction provenance",
  () => {
    for (const token of [
      "AUDIT_REFERENCE_MISSING",
      "with task_source as",
      "from public.source_links",
      "from public.ai_proposals",
      "from public.ai_runs",
      "from public.domain_events",
      "left join public.audit_events",
      "'MessageCreated'",
      "'AIProposalCreated'",
      "'AIProposalConfirmed'",
      "'AIProposalEdited'",
      "'AIProposalRejected'",
      "'TaskCreated'",
      "e.actor_type",
      "e.actor_id",
      "e.correlation_id",
      "e.causation_id",
      "e.occurred_at asc",
      "e.id asc",
    ]) {
      assert.ok(
        migration.includes(token),
        `Audit reconstruction token missing: ${token}`
      );
    }
  }
);


test(
  "Audit persistence remains service-role-only",
  () => {
    assert.ok(
      migration.includes(
        "security definer"
      )
    );

    assert.ok(
      migration.includes(
        "set search_path = public, pg_temp"
      )
    );

    assert.ok(
      migration.includes(
        "from anon, authenticated;"
      )
    );

    assert.ok(
      migration.includes(
        "to service_role;"
      )
    );
  }
);
