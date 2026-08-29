import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260825120000_vs002_membership_domain_events.sql"
  ),
  "utf8"
);

const service = readFileSync(
  resolve(
    process.cwd(),
    "src/modules/project-membership/project-membership.service.ts"
  ),
  "utf8"
);


function functionBody(
  name: string
): string {
  const body = migration.match(
    new RegExp(
      `create function public\\.${name}[\\s\\S]*?end;\\s*\\$\\$;`
    )
  )?.[0];

  assert.ok(
    body,
    `${name} must exist in the forward migration`
  );
  return body;
}


function occurrences(
  value: string,
  pattern: RegExp
): number {
  return [...value.matchAll(pattern)].length;
}


test(
  "VS002-07B is prospective and leaves Audit and TypeScript producers untouched",
  () => {
    assert.doesNotMatch(
      migration,
      /insert into public\.domain_event_subscriptions|project_domain_event_to_audit|insert into public\.audit_events/i
    );
    assert.doesNotMatch(
      migration,
      /from public\.domain_events[^;]*insert/i
    );
    assert.doesNotMatch(
      service,
      /domain_events|DomainEventRepository|ProjectMemberAdded|ProjectRoleAssigned/
    );
  }
);


test(
  "admission emits MemberAdded and initial RoleAssigned atomically with one correlation and stable Person actor",
  () => {
    const body = functionBody(
      "add_project_member"
    );

    assert.match(
      body,
      /p_correlation_id uuid/
    );
    assert.equal(
      occurrences(
        body,
        /'ProjectMemberAdded'/g
      ),
      1
    );
    assert.equal(
      occurrences(
        body,
        /'ProjectRoleAssigned'/g
      ),
      1
    );
    assert.match(
      body,
      /'INITIAL_ORDINARY'/
    );
    assert.match(
      body,
      /'person',\s*p_granted_by_person_id,[\s\S]*p_correlation_id/
    );
    assert.match(
      body,
      /with mutation as materialized[\s\S]*insert into public\.domain_events[\s\S]*emitted_count = 2/
    );
  }
);


test(
  "ordinary replacement emits revoke plus assign while zero history emits assign only",
  () => {
    const body = functionBody(
      "change_project_ordinary_role"
    );

    assert.match(
      body,
      /p_correlation_id uuid/
    );
    assert.match(
      body,
      /'ProjectRoleRevoked'[\s\S]*where v_had_before[\s\S]*union all[\s\S]*'ProjectRoleAssigned'/
    );
    assert.match(
      body,
      /'previous_assignment_id', m\.closed_assignment_id/
    );
    assert.match(
      body,
      /case when v_had_before then 2 else 1 end/
    );
    assert.match(
      body,
      /'person',\s*p_assigned_by_person_id,[\s\S]*p_correlation_id/
    );
    assert.doesNotMatch(
      body,
      /coalesce\(m\.closed_assignment_id/i
    );
  }
);


test(
  "protected appointment emits Assigned and transfer emits Transferred with ledger aggregate",
  () => {
    const body = functionBody(
      "transfer_project_protected_role"
    );

    assert.match(
      body,
      /when v_had_outgoing then 'ProjectRoleTransferred'[\s\S]*else 'ProjectRoleAssigned'/
    );
    assert.match(
      body,
      /when v_had_outgoing then 'project_role_transfer'[\s\S]*else 'project_membership'/
    );
    assert.match(
      body,
      /when v_had_outgoing then m\.transfer_id[\s\S]*else m\.new_assignment_membership_id/
    );
    assert.match(
      body,
      /'PROTECTED_APPOINTMENT'/
    );
    assert.match(
      body,
      /'affected_person_ids'[\s\S]*'transfer'[\s\S]*'correlation_id', m\.transfer_correlation_id/
    );
    assert.match(
      body,
      /'person',\s*p_authorised_by_person_id/
    );
  }
);


test(
  "administrative removal emits one self-contained event only on the first ENDED transition",
  () => {
    const body = functionBody(
      "terminate_project_membership"
    );

    assert.equal(
      occurrences(
        body,
        /'ProjectMemberRemoved'/g
      ),
      1
    );
    assert.doesNotMatch(
      body,
      /ProjectRoleRevoked/
    );
    assert.match(
      body,
      /'before', public\.vs002_07_membership_event_state\(v_before\)/
    );
    assert.match(
      body,
      /'closed_role_assignments'[\s\S]*vs002_07_role_event_states\(m\.closed_assignments\)/
    );
    assert.match(
      body,
      /where m\.lifecycle_outcome = 'ENDED'/
    );
    assert.match(
      body,
      /'person',\s*m\.result_terminated_by_person_id/
    );
  }
);


test(
  "expiry emits one system event at materialisation and keeps the original boundary as effective time",
  () => {
    const body = functionBody(
      "finalize_project_membership_expiry"
    );

    assert.equal(
      occurrences(
        body,
        /'ProjectMembershipExpired'/g
      ),
      1
    );
    assert.doesNotMatch(
      body,
      /ProjectRoleRevoked/
    );
    assert.match(
      body,
      /'system',\s*null/
    );
    assert.match(
      body,
      /'effective_at', m\.result_effective_to/
    );
    assert.match(
      body,
      /'materialized_at', m\.result_terminated_at/
    );
    assert.match(
      body,
      /where m\.lifecycle_outcome = 'ENDED'/
    );
  }
);


test(
  "event failure rolls back mutation and private state helpers are not callable by API roles",
  () => {
    for (const name of [
      "add_project_member",
      "change_project_ordinary_role",
      "transfer_project_protected_role",
      "terminate_project_membership",
      "finalize_project_membership_expiry",
    ]) {
      const body = functionBody(name);
      const mutationIndex =
        body.indexOf(
          "with mutation as materialized"
        );
      const eventIndex =
        body.indexOf(
          "insert into public.domain_events"
        );

      assert.ok(
        mutationIndex >= 0 &&
          eventIndex > mutationIndex,
        `${name} must mutate and emit inside one RPC transaction`
      );
    }

    assert.match(
      migration,
      /revoke all on function public\.vs002_07_add_project_member_state[\s\S]*from public, anon, authenticated, service_role/
    );
    assert.match(
      migration,
      /revoke all on function public\.vs002_07_finalize_expiry_state[\s\S]*from public, anon, authenticated, service_role/
    );
  }
);


test(
  "public producer RPCs remain service-role-only and actor_type accepts stable Person provenance",
  () => {
    assert.match(
      migration,
      /actor_type in \([\s\S]*'human',[\s\S]*'person',[\s\S]*'agent',[\s\S]*'system'/
    );

    for (const name of [
      "add_project_member",
      "change_project_ordinary_role",
      "transfer_project_protected_role",
      "terminate_project_membership",
      "finalize_project_membership_expiry",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function public\\.${name}[\\s\\S]*?from public, anon, authenticated;[\\s\\S]*?grant execute on function public\\.${name}[\\s\\S]*?to service_role;`
        )
      );
    }
  }
);
