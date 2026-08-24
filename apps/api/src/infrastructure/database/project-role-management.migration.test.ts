import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";


const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260822120000_vs002_role_management.sql"
  ),
  "utf8"
);

const executableMigration = migration
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");


test(
  "ordinary change locks membership and validates project and effective period",
  () => {
    assert.match(
      migration,
      /change_project_ordinary_role[\s\S]*from public\.project_memberships as membership[\s\S]*where membership\.id = p_membership_id[\s\S]*for update/
    );
    assert.match(
      migration,
      /v_membership\.project_id <> p_project_id[\s\S]*PROJECT_MEMBERSHIP_PROJECT_MISMATCH/
    );
    assert.match(
      migration,
      /p_effective_at < v_membership\.effective_from[\s\S]*p_effective_at >= v_membership\.effective_to[\s\S]*PROJECT_MEMBERSHIP_NOT_EFFECTIVE/
    );
  }
);


test(
  "ordinary change supports zero history and rejects invalid current state",
  () => {
    assert.match(
      migration,
      /v_effective_count > 1[\s\S]*PROJECT_ROLE_ORDINARY_CARDINALITY_INVALID/
    );
    assert.match(
      migration,
      /v_effective_count = 1[\s\S]*v_closed\.role = p_role[\s\S]*PROJECT_ROLE_ORDINARY_UNCHANGED/
    );
    assert.match(
      migration,
      /Zero previous assignment is a truthful VS-001 compatibility case/
    );
    assert.doesNotMatch(
      migration,
      /coalesce\(v_closed\.id/i,
      "Missing legacy history must not be fabricated."
    );
  }
);


test(
  "ordinary change closes history then inserts bounded assignment with provenance",
  () => {
    assert.match(
      migration,
      /update public\.project_role_assignments\s+set effective_to = p_effective_at\s+where id = v_closed\.id/
    );
    assert.doesNotMatch(
      executableMigration,
      /delete\s+from public\.project_role_assignments/i
    );
    assert.match(
      migration,
      /insert into public\.project_role_assignments[\s\S]*p_role,[\s\S]*p_effective_at,[\s\S]*v_membership\.effective_to,[\s\S]*p_assigned_by_person_id,[\s\S]*p_change_reason/
    );
  }
);


test(
  "ordinary RPC accepts only ordinary roles and rejects protected roles",
  () => {
    assert.match(
      migration,
      /p_role in \(\s*'PROJECT_SPONSOR',[\s\S]*'PROJECT_OWNER',[\s\S]*'PROJECT_MANAGER'[\s\S]*PROJECT_ROLE_TRANSFER_REQUIRED/
    );
    assert.match(
      migration,
      /p_role not in \(\s*'PROJECT_MEMBER',[\s\S]*'PROJECT_OBSERVER',[\s\S]*'PROJECT_AUDITOR'[\s\S]*PROJECT_ROLE_ORDINARY_REQUIRED/
    );
  }
);


test(
  "protected operation locks project before inspecting holder state",
  () => {
    const functionBody = migration.match(
      /create or replace function public\.transfer_project_protected_role[\s\S]*?end;\s*\$\$;/
    )?.[0];
    assert.ok(functionBody);
    const projectLock = functionBody.indexOf(
      "from public.projects as project"
    );
    const holderCount = functionBody.indexOf(
      "select count(*)"
    );
    assert.ok(projectLock >= 0 && projectLock < holderCount);
    assert.match(
      functionBody,
      /from public\.projects as project[\s\S]*for update/
    );
    assert.match(
      functionBody,
      /v_effective_count > 1[\s\S]*PROJECT_ROLE_PROTECTED_CARDINALITY_INVALID/
    );
  }
);


test(
  "protected operation validates incoming membership and same-holder transfer",
  () => {
    assert.match(
      migration,
      /p_incoming_membership_id[\s\S]*v_membership\.project_id <> p_project_id[\s\S]*PROJECT_MEMBERSHIP_PROJECT_MISMATCH/
    );
    assert.match(
      migration,
      /p_effective_at < v_membership\.effective_from[\s\S]*p_effective_at >= v_membership\.effective_to[\s\S]*PROJECT_MEMBERSHIP_NOT_EFFECTIVE/
    );
    assert.match(
      migration,
      /v_outgoing\.membership_id =[\s\S]*p_incoming_membership_id[\s\S]*PROJECT_ROLE_PROTECTED_HOLDER_UNCHANGED/
    );
  }
);


test(
  "first appointment and transfer share one operation while preserving history",
  () => {
    assert.match(
      migration,
      /if v_effective_count = 1 then[\s\S]*set effective_to = p_effective_at[\s\S]*end if;[\s\S]*insert into public\.project_role_assignments/
    );
    assert.match(
      migration,
      /insert into public\.project_role_transfers[\s\S]*v_outgoing\.id,[\s\S]*v_incoming\.id/
    );
    assert.match(
      migration,
      /outgoing_assignment_id uuid,/
    );
    assert.match(
      migration,
      /incoming_assignment_id uuid not null/
    );
  }
);


test(
  "protected assignment is bounded by incoming membership and ignores affiliation",
  () => {
    assert.match(
      migration,
      /p_incoming_assignment_id,[\s\S]*p_incoming_membership_id,[\s\S]*p_role,[\s\S]*p_effective_at,[\s\S]*v_membership\.effective_to/
    );
    assert.doesNotMatch(
      executableMigration,
      /organisational_affiliations|INTERNAL|EXTERNAL/i
    );
  }
);


test(
  "transfer ledger enforces protected roles and assignment consistency",
  () => {
    for (const role of [
      "PROJECT_SPONSOR",
      "PROJECT_OWNER",
      "PROJECT_MANAGER",
    ]) {
      assert.match(migration, new RegExp(`'${role}'`));
    }
    assert.match(
      migration,
      /foreign key \(\s*outgoing_assignment_id,\s*project_id,\s*role\s*\)[\s\S]*references public\.project_role_assignments\(\s*id,\s*project_id,\s*role/
    );
    assert.match(
      migration,
      /foreign key \(\s*incoming_assignment_id,\s*project_id,\s*role\s*\)[\s\S]*references public\.project_role_assignments\(\s*id,\s*project_id,\s*role/
    );
  }
);


test(
  "transfer ledger retains provenance and is immutable",
  () => {
    assert.match(
      migration,
      /authorised_by_person_id uuid not null[\s\S]*references public\.persons/
    );
    assert.match(migration, /reason text not null/);
    assert.match(migration, /correlation_id uuid not null/);
    assert.match(migration, /effective_at timestamptz not null/);
    assert.match(
      migration,
      /project_role_transfers_reason_not_blank[\s\S]*btrim\(reason\) <> ''/
    );
    assert.match(
      migration,
      /project_role_transfers_prevent_update/
    );
    assert.match(
      migration,
      /project_role_transfers_prevent_hard_delete/
    );
    assert.match(
      migration,
      /grant select on table[\s\S]*project_role_transfers[\s\S]*to service_role/
    );
    assert.doesNotMatch(
      migration,
      /grant[^;]*insert[^;]*project_role_transfers[^;]*to service_role/,
      "Ledger inserts must pass through the transactional RPC."
    );
  }
);


test(
  "role-management persistence emits no domain events",
  () => {
    assert.doesNotMatch(
      executableMigration,
      /insert into public\.domain_events/i
    );
  }
);


test(
  "role-management RPCs are security-definer service-role only",
  () => {
    for (const functionName of [
      "change_project_ordinary_role",
      "transfer_project_protected_role",
    ]) {
      const escaped = functionName.replace("_", "_");
      assert.match(
        migration,
        new RegExp(
          `function public\\.${escaped}\\([\\s\\S]*security definer[\\s\\S]*set search_path = public, pg_temp`
        )
      );
      for (const role of ["public", "anon", "authenticated"]) {
        assert.match(
          migration,
          new RegExp(
            `revoke all on function public\\.${escaped}\\([\\s\\S]*from ${role};`
          )
        );
      }
      assert.match(
        migration,
        new RegExp(
          `grant execute on function public\\.${escaped}\\([\\s\\S]*to service_role;`
        )
      );
    }
  }
);


test(
  "legacy compatibility copies only from existing assign-owner holders",
  () => {
    assert.match(
      migration,
      /'member\.assign_manager'/
    );
    assert.match(
      migration,
      /'member\.assign_sponsor'/
    );
    assert.match(
      migration,
      /from public\.role_permissions[\s\S]*owner_permission\.code =\s*'member\.assign_owner'[\s\S]*missing_permission\.code in \(\s*'member\.assign_manager',[\s\S]*'member\.assign_sponsor'/
    );
    const compatibilityInsert = migration.match(
      /insert into public\.role_permissions[\s\S]*?on conflict do nothing;/
    )?.[0];
    assert.ok(compatibilityInsert);
    assert.doesNotMatch(
      compatibilityInsert,
      /r\.code|PROJECT_OWNER|PROJECT_LEAD|CONTRIBUTOR|REVIEWER|VIEWER/,
      "Compatibility must follow existing permission grants, not inferred role names."
    );
  }
);
