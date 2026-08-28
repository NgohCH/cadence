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
      "../../supabase/migrations/20260828134500_r02e_task_creation_authorisation_cutover.sql"
    ),
    "utf8"
  );


test(
  "Task persistence contains no project authorization decision",
  () => {
    assert.ok(
      migration.includes(
        "create or replace function public.create_authoritative_task"
      )
    );

    assert.ok(
      !migration.includes(
        "has_project_permission"
      )
    );

    assert.ok(
      !migration.includes(
        "TASK_CREATE_PERMISSION_DENIED"
      )
    );

    assert.ok(
      !migration.includes(
        "TASK_ASSIGN_PERMISSION_DENIED"
      )
    );
  }
);


test(
  "Task assignee integrity uses stable Person effective membership",
  () => {
    for (const token of [
      "assignee_user.person_id",
      "pm.person_id",
      "pm.membership_status",
      "pm.effective_from",
      "pm.effective_to",
      "TASK_ASSIGNEE_NOT_PROJECT_MEMBER",
    ]) {
      assert.ok(
        migration.includes(token),
        `Missing token: ${token}`
      );
    }

    assert.ok(
      !migration.includes(
        "pm.user_id"
      )
    );

    assert.ok(
      !migration.includes(
        "pm.status"
      )
    );
  }
);


test(
  "Task persistence preserves idempotency provenance and event creation",
  () => {
    for (const token of [
      "insert into public.tasks",
      "insert into public.source_links",
      "when unique_violation",
      "insert into public.domain_events",
      "'TaskCreated'",
      "p_correlation_id",
      "p_causation_id",
    ]) {
      assert.ok(
        migration.includes(token),
        `Missing token: ${token}`
      );
    }
  }
);


test(
  "Task persistence remains service-role-only",
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
