import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";


const migration = readFileSync(
  resolve(
    __dirname,
    "../../../../../supabase/migrations/20260828180000_r03c_structural_membership_invariants.sql"
  ),
  "utf8"
);

const functionDefinition = (name: string): string => {
  const definition = migration.match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)[\\s\\S]*?\\$\\$;`,
      "i"
    )
  );

  assert.ok(definition, `Missing R03C function definition: ${name}`);
  return definition[0];
};


test(
  "R03C structurally excludes membership and role-period overlaps",
  () => {
    assert.match(
      migration,
      /create extension if not exists btree_gist/i
    );

    for (const constraint of [
      "project_memberships_person_project_period_excl",
      "project_role_assignments_ordinary_period_excl",
      "project_role_assignments_protected_period_excl",
    ]) {
      assert.ok(migration.includes(constraint));
    }

    assert.match(
      migration,
      /tstzrange\(effective_from, effective_to, '\[\)'\) with &&/i
    );
  }
);


test(
  "R03C elevates only the deferred internal wrappers",
  () => {
    const deferredWrappers = [
      "enforce_membership_ordinary_role_coverage",
      "enforce_assignment_ordinary_role_coverage",
      "enforce_protected_assignment_transfer",
    ];
    const invokerFunctions = [
      "enforce_role_assignment_within_membership",
      "enforce_membership_period_contains_roles",
      "enforce_canonical_membership_lifecycle",
      "prevent_membership_termination_rewrite",
      "enforce_project_role_transfer_consistency",
      "assert_project_membership_ordinary_role_coverage",
      "assert_protected_assignment_transfer",
    ];

    for (const name of deferredWrappers) {
      const definition = functionDefinition(name);
      assert.match(definition, /security\s+definer/i);
      assert.match(
        definition,
        /set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
    }

    for (const name of invokerFunctions) {
      const definition = functionDefinition(name);
      assert.doesNotMatch(definition, /security\s+definer/i);
      assert.match(
        definition,
        /set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
    }

    for (const name of [
      ...deferredWrappers,
      "assert_project_membership_ordinary_role_coverage",
      "assert_protected_assignment_transfer",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
          "i"
        )
      );
      assert.doesNotMatch(
        migration,
        new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+public\\.${name}`,
          "i"
        )
      );
    }
  }
);


test(
  "R03C enforces role containment in both write directions",
  () => {
    for (const token of [
      "PROJECT_ROLE_PERIOD_OUTSIDE_MEMBERSHIP",
      "PROJECT_MEMBERSHIP_PERIOD_EXCLUDES_ROLE_HISTORY",
      "project_role_assignments_enforce_membership_period",
      "project_memberships_contain_role_periods",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);


test(
  "R03C distinguishes at-most-one ordinary role from exact coverage",
  () => {
    assert.ok(
      migration.includes(
        "project_role_assignments_ordinary_period_excl"
      ),
      "The exclusion constraint supplies only at-most-one enforcement."
    );

    for (const token of [
      "range_agg",
      "PROJECT_MEMBERSHIP_ORDINARY_ROLE_COVERAGE_INVALID",
      "project_memberships_require_ordinary_role",
      "project_role_assignments_require_ordinary_role",
      "deferrable initially deferred",
    ]) {
      assert.ok(
        migration.toLowerCase().includes(
          token.toLowerCase()
        )
      );
    }
  }
);


test(
  "R03C makes protected assignments and transfer history agree",
  () => {
    for (const token of [
      "project_role_transfers_incoming_assignment_uidx",
      "project_role_transfers_outgoing_assignment_uidx",
      "PROJECT_ROLE_TRANSFER_INCOMING_INCONSISTENT",
      "PROJECT_ROLE_TRANSFER_OUTGOING_INCONSISTENT",
      "PROJECT_ROLE_PROTECTED_TRANSFER_LEDGER_REQUIRED",
      "project_role_assignments_require_transfer",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);


test(
  "R03C preserves canonical lifecycle and every frozen legacy column",
  () => {
    assert.ok(
      migration.includes(
        "PROJECT_MEMBERSHIP_CANONICAL_TERMINATION_REQUIRED"
      )
    );

    assert.match(
      migration,
      /new\.membership_status[\s\S]*old\.membership_status/i
    );

    for (const column of [
      "user_id",
      "role_id",
      "joined_at",
      "status",
      "created_by",
    ]) {
      assert.ok(migration.includes(`'${column}'`));
    }

    assert.doesNotMatch(
      migration,
      /drop\s+column/i
    );
  }
);


test(
  "R03C preflights all structural invariants before installation",
  () => {
    for (const token of [
      "R03C_MEMBERSHIP_OVERLAP_PREFLIGHT_FAILED",
      "R03C_ROLE_PERIOD_PREFLIGHT_FAILED",
      "R03C_ORDINARY_ROLE_OVERLAP_PREFLIGHT_FAILED",
      "R03C_PROTECTED_ROLE_OVERLAP_PREFLIGHT_FAILED",
      "R03C_TRANSFER_HISTORY_PREFLIGHT_FAILED",
      "R03C_PROTECTED_ROLE_LEDGER_PREFLIGHT_FAILED",
      "R03C_ORDINARY_ROLE_COVERAGE_PREFLIGHT_FAILED",
    ]) {
      assert.ok(migration.includes(token));
    }
  }
);
