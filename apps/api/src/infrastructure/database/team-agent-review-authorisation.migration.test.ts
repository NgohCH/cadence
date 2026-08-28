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
    "../../supabase/migrations/20260827223000_r02e_team_agent_review_authorisation_cutover.sql"
  );


const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );


test(
  "R02E Team Agent review RPC contains no project permission decision",
  () => {
    assert.match(
      migration,
      /create or replace function public\.review_team_agent_task_proposal/
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
      /['"]agent\.approve['"]/i
    );

    assert.doesNotMatch(
      migration,
      /TEAM_AGENT_REVIEW_PERMISSION_DENIED/
    );
  }
);


test(
  "R02E Team Agent review preserves locking and terminal review transition",
  () => {
    assert.match(
      migration,
      /proposal\.proposal_type\s*=\s*'task'/
    );

    assert.match(
      migration,
      /for update;/
    );

    assert.match(
      migration,
      /TEAM_AGENT_PROPOSAL_NOT_FOUND/
    );

    assert.match(
      migration,
      /v_proposal\.status\s*<>\s*'pending'/
    );

    assert.match(
      migration,
      /TEAM_AGENT_PROPOSAL_ALREADY_REVIEWED/
    );

    assert.match(
      migration,
      /TEAM_AGENT_REVIEW_ACTION_INVALID/
    );
  }
);


test(
  "R02E Team Agent review preserves payload provenance and event atomicity",
  () => {
    for (const token of [
      "TEAM_AGENT_CONFIRM_PAYLOAD_NOT_ALLOWED",
      "TEAM_AGENT_EDIT_PAYLOAD_REQUIRED",
      "TEAM_AGENT_TASK_TITLE_REQUIRED",
      "TEAM_AGENT_PROPOSAL_PROVENANCE_IMMUTABLE",
      "TEAM_AGENT_REJECT_PAYLOAD_NOT_ALLOWED",
      "insert into public.domain_events",
      "'AIProposalConfirmed'",
      "'AIProposalEdited'",
      "'AIProposalRejected'",
      "p_reviewer_user_id",
      "p_correlation_id",
    ]) {
      assert.ok(
        migration.includes(token),
        `Team Agent persistence token missing: ${token}`
      );
    }
  }
);


test(
  "R02E Team Agent review RPC remains security-definer service-role-only",
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
      /revoke all on function public\.review_team_agent_task_proposal\([\s\S]*?\)\s*from public;/
    );

    assert.match(
      migration,
      /revoke all on function public\.review_team_agent_task_proposal\([\s\S]*?\)\s*from anon, authenticated;/
    );

    assert.match(
      migration,
      /grant execute on function public\.review_team_agent_task_proposal\([\s\S]*?\)\s*to service_role;/
    );
  }
);
