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
      "../../supabase/migrations/20260828160000_r03a_legacy_membership_write_freeze.sql"
    ),
    "utf8"
  );


test(
  "R03A retains every legacy membership column",
  () => {
    assert.doesNotMatch(
      migration,
      /drop\s+column/i
    );

    for (const column of [
      "user_id",
      "role_id",
      "status",
      "joined_at",
      "created_by",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `project_memberships\\.${column}`
        ),
        `Expected retained-column documentation missing: ${column}`
      );
    }
  }
);


test(
  "R03A rejects new legacy-shaped memberships",
  () => {
    assert.match(
      migration,
      /tg_op = 'INSERT'[\s\S]*new\.user_id is not null[\s\S]*new\.role_id is not null[\s\S]*R03A_NEW_LEGACY_MEMBERSHIP_SHAPE_FORBIDDEN/i
    );
  }
);


test(
  "R03A freezes historical legacy membership identity and provenance",
  () => {
    for (const column of [
      "user_id",
      "role_id",
      "joined_at",
      "created_by",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `new\\.${column} is distinct from old\\.${column}`
        ),
        `Expected immutable legacy field missing: ${column}`
      );
    }

    assert.match(
      migration,
      /R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE/i
    );

    assert.doesNotMatch(
      migration,
      /new\.status is distinct from old\.status/i,
      "R03A must preserve the current lifecycle RPC compatibility path."
    );
  }
);


test(
  "R03A installs a protected write guard and deployment postconditions",
  () => {
    assert.match(
      migration,
      /create trigger\s+project_memberships_freeze_legacy_fields[\s\S]*before insert or update[\s\S]*on public\.project_memberships/i
    );

    assert.match(
      migration,
      /revoke all on function\s+public\.enforce_legacy_membership_write_freeze\(\)\s+from public, anon, authenticated;/i
    );

    for (const token of [
      "R03A_LEGACY_MEMBERSHIP_PAIR_INVALID",
      "R03A_LEGACY_MEMBERSHIP_FREEZE_MISSING",
    ]) {
      assert.ok(
        migration.includes(token),
        `Migration postcondition missing: ${token}`
      );
    }
  }
);
