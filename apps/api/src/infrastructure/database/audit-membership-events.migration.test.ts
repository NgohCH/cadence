import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260826120000_vs002_membership_audit_projection.sql"
  ),
  "utf8"
);

const handler = readFileSync(
  resolve(
    process.cwd(),
    "src/modules/audit/audit-domain-event.handler.ts"
  ),
  "utf8"
);


const eventTypes = [
  "ProjectMemberAdded",
  "ProjectMemberRemoved",
  "ProjectMembershipExpired",
  "ProjectRoleAssigned",
  "ProjectRoleRevoked",
  "ProjectRoleTransferred",
] as const;


test(
  "Audit extends the existing domain-event projection with six distinct actions",
  () => {
    assert.match(
      migration,
      /create or replace function public\.project_domain_event_to_audit/
    );

    for (const [eventType, action]
      of [
        ["ProjectMemberAdded", "project_member.added"],
        ["ProjectMemberRemoved", "project_member.removed"],
        ["ProjectMembershipExpired", "project_membership.expired"],
        ["ProjectRoleAssigned", "project_role.assigned"],
        ["ProjectRoleRevoked", "project_role.revoked"],
        ["ProjectRoleTransferred", "project_role.transferred"],
      ] as const) {
      assert.match(
        migration,
        new RegExp(
          `when '${eventType}' then\\s*'${action.replace(".", "\\.")}'`
        )
      );
    }
  }
);


test(
  "Audit uses producer snapshots and envelope provenance without membership persistence reconstruction",
  () => {
    assert.match(
      migration,
      /v_before_state :=\s*v_event\.payload -> 'before'/
    );
    assert.match(
      migration,
      /v_after_state :=\s*v_event\.payload -> 'after'/
    );
    assert.match(
      migration,
      /v_event\.correlation_id,[\s\S]*v_event\.project_id,[\s\S]*v_event\.actor_type,[\s\S]*v_event\.actor_id/
    );
    assert.match(
      migration,
      /'effective_at'[\s\S]*'materialized_at'[\s\S]*'reason'[\s\S]*'termination'[\s\S]*'transfer'/
    );
    assert.match(
      migration,
      /'outgoing_person_id'[\s\S]*'incoming_person_id'[\s\S]*'outgoing_membership_id'[\s\S]*'incoming_membership_id'/
    );
    assert.doesNotMatch(
      migration,
      /from public\.(project_memberships|project_role_assignments|project_role_transfers|persons|authentication_identities|projects|tasks)\b/i
    );
    assert.doesNotMatch(
      handler,
      /Repository|project_memberships|project_role_assignments|project_role_transfers|persons|projects|tasks/
    );
  }
);


test(
  "all six VS002 v1 events are subscribed prospectively without replay",
  () => {
    for (const eventType of eventTypes) {
      assert.match(
        migration,
        new RegExp(
          `'audit\\.domain-events\\.v1', '${eventType}', 1, true`
        )
      );
    }

    assert.doesNotMatch(
      migration,
      /for\s+\w+\s+in\s+select|insert into public\.domain_event_deliveries|perform\s+public\.project_domain_event_to_audit/i
    );
  }
);


test(
  "event ID remains the sole idempotency boundary and projection failure stays retryable",
  () => {
    assert.match(
      migration,
      /on conflict \(event_id\)\s*do nothing/
    );
    assert.match(
      migration,
      /get diagnostics\s*v_inserted_rows = row_count/
    );
    assert.doesNotMatch(
      migration,
      /update public\.domain_event_deliveries|delete from public\.domain_event_deliveries/i
    );
  }
);


test(
  "Audit storage accepts Person actors while preserving existing actor types",
  () => {
    assert.match(
      migration,
      /actor_type in \([\s\S]*'human',[\s\S]*'person',[\s\S]*'agent',[\s\S]*'system'/
    );
    assert.match(
      migration,
      /revoke all on function public\.project_domain_event_to_audit[\s\S]*from public, anon, authenticated/
    );
    assert.match(
      migration,
      /grant execute on function public\.project_domain_event_to_audit[\s\S]*to service_role/
    );
  }
);
