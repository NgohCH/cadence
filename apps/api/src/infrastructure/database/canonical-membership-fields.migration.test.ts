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
      "../../supabase/migrations/20260828170000_r03b_canonical_membership_fields.sql"
    ),
    "utf8"
  );


test(
  "R03B detaches and constrains canonical membership fields",
  () => {
    assert.match(
      migration,
      /alter column effective_from drop expression[\s\S]*alter column membership_status drop expression/i
    );

    assert.match(
      migration,
      /alter column effective_from set not null[\s\S]*alter column membership_status set not null/i
    );

    assert.match(
      migration,
      /project_memberships_membership_status_check[\s\S]*membership_status in \('ACTIVE', 'ENDED'\)/i
    );
  }
);


test(
  "R03B moves authoritative state helpers to canonical fields",
  () => {
    for (const token of [
      "existing_membership.membership_status",
      "effective_from",
      "membership_status",
      "membership_status = ''ENDED''",
      "R03B_ADMISSION_HELPER_RECONCILIATION_FAILED",
      "R03B_TERMINATION_HELPER_RECONCILIATION_FAILED",
      "R03B_EXPIRY_HELPER_RECONCILIATION_FAILED",
    ]) {
      assert.ok(
        migration.includes(token),
        `Canonical helper replacement missing: ${token}`
      );
    }
  }
);


test(
  "R03B normalizes helper definitions before guarded reconciliation",
  () => {
    const helperGuards = [
      [
        "vs002_07_add_project_member_state",
        "R03B_ADMISSION_HELPER_RECONCILIATION_FAILED",
      ],
      [
        "vs002_07_terminate_membership_state",
        "R03B_TERMINATION_HELPER_RECONCILIATION_FAILED",
      ],
      [
        "vs002_07_finalize_expiry_state",
        "R03B_EXPIRY_HELPER_RECONCILIATION_FAILED",
      ],
    ] as const;

    for (const [helper, guard] of helperGuards) {
      const helperStart = migration.indexOf(`'public.${helper}(`);
      const guardPosition = migration.indexOf(guard, helperStart);
      const reconciliation = migration.slice(
        helperStart,
        guardPosition
      );
      const capturePosition = reconciliation.indexOf(
        "into v_definition;"
      );
      const crlfNormalizationPosition = reconciliation.indexOf(
        "replace(v_definition, E'\\r\\n', E'\\n')"
      );
      const crNormalizationPosition = reconciliation.indexOf(
        "replace(v_definition, E'\\r', E'\\n')"
      );
      const originalPosition = reconciliation.indexOf(
        "v_original := v_definition;"
      );
      const replacementPosition = reconciliation.indexOf(
        "v_definition := replace(",
        originalPosition
      );

      assert.ok(helperStart >= 0, `Helper missing: ${helper}`);
      assert.ok(guardPosition >= 0, `Guard missing: ${guard}`);
      assert.ok(
        capturePosition < crlfNormalizationPosition,
        `${helper} must normalize CRLF after capturing its definition`
      );
      assert.ok(
        crlfNormalizationPosition < crNormalizationPosition,
        `${helper} must normalize CRLF before lone CR`
      );
      assert.ok(
        crNormalizationPosition < originalPosition,
        `${helper} must snapshot the original after normalization`
      );
      assert.ok(
        originalPosition < replacementPosition,
        `${helper} must normalize before semantic replacements`
      );
    }
  }
);


test(
  "R03B retires legacy status schema interpretation",
  () => {
    for (const objectName of [
      "project_memberships_active_user_project_uidx",
      "project_memberships_project_status_idx",
      "project_memberships_user_status_idx",
      "project_memberships_status_check",
    ]) {
      assert.ok(
        migration.includes(objectName),
        `Legacy status dependency retirement missing: ${objectName}`
      );
    }

    assert.match(
      migration,
      /new\.status is distinct from old\.status/i
    );
  }
);


test(
  "R03B retains every legacy membership column",
  () => {
    assert.doesNotMatch(
      migration,
      /drop\s+column/i
    );

    for (const column of [
      "user_id",
      "role_id",
      "joined_at",
      "status",
      "created_by",
    ]) {
      assert.match(
        migration,
        new RegExp(`'${column}'`),
        `Retained legacy column postcondition missing: ${column}`
      );
    }
  }
);


test(
  "R03B includes live dependency-removal postconditions",
  () => {
    for (const token of [
      "R03B_CANONICAL_COLUMN_STILL_GENERATED",
      "R03B_CANONICAL_COLUMN_NULLABLE",
      "R03B_LEGACY_STATUS_INDEX_REMAINS",
      "R03B_LEGACY_STATUS_CONSTRAINT_REMAINS",
      "R03B_R03A_STATUS_FREEZE_MISSING",
      "R03B_LEGACY_STATE_HELPER_DEPENDENCY_REMAINS",
      "R03B_LEGACY_MEMBERSHIP_COLUMN_MISSING",
    ]) {
      assert.ok(
        migration.includes(token),
        `R03B postcondition missing: ${token}`
      );
    }
  }
);
