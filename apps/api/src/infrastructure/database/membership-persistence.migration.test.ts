import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";


const migrationPath = resolve(
  process.cwd(),
  "../../supabase/migrations/20260820000100_vs002_membership_persistence.sql"
);

const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );


test(
  "VS002-02 migration uses deterministic primary-key identity bridging",
  () => {
    assert.match(
      migration,
      /insert into public\.persons[\s\S]*select[\s\S]*u\.id,[\s\S]*from public\.users u;/
    );

    assert.match(
      migration,
      /update public\.users\s+set person_id = id;/
    );

    assert.doesNotMatch(
      migration,
      /where[^;]*(display_name|email|username)[^;]*=/i,
      "Identity backfill must not match people by mutable identity data."
    );
  }
);


test(
  "VS002-02 migration evolves the existing membership table and separates role history",
  () => {
    assert.match(
      migration,
      /alter table public\.project_memberships/
    );

    assert.doesNotMatch(
      migration,
      /create table public\.project_memberships/
    );

    assert.match(
      migration,
      /create table public\.project_role_assignments/
    );

    assert.match(
      migration,
      /foreign key \(membership_id, project_id\)[\s\S]*references public\.project_memberships\(id, project_id\)/
    );

    assert.match(
      migration,
      /foreign key \(user_id, person_id\)[\s\S]*references public\.users\(id, person_id\)/
    );

    assert.match(
      migration,
      /\(user_id is null and role_id is null\)[\s\S]*or \(user_id is not null and role_id is not null\)/
    );
  }
);


test(
  "VS002-02 preserves unavailable legacy grantor provenance without fabrication",
  () => {
    assert.match(
      migration,
      /granted_by_person_id\s*=\s*\(\s*select grantor\.person_id\s+from public\.users grantor\s+where grantor\.id = pm\.created_by\s*\)/
    );

    assert.doesNotMatch(
      migration,
      /granted_by_person_id\s*=\s*coalesce/i,
      "A null VS-001 created_by must remain unknown rather than use a substitute Person."
    );
  }
);


test(
  "VS002-02 requires grantor provenance for new Person-only memberships",
  () => {
    assert.match(
      migration,
      /constraint project_memberships_person_only_grantor_required\s+check \(\s*user_id is not null\s+or granted_by_person_id is not null\s*\)/
    );
  }
);


test(
  "VS002-02 restricts the existing membership SELECT policy to VS-001 compatibility rows",
  () => {
    assert.match(
      migration,
      /drop policy memberships_select_project_member\s+on public\.project_memberships;/
    );

    assert.match(
      migration,
      /create policy memberships_select_project_member\s+on public\.project_memberships for select to authenticated\s+using \(\s*user_id is not null\s+and role_id is not null\s+and \(select public\.is_project_member\(project_id\)\)\s*\);/
    );
  }
);


test(
  "VS001 compatibility policy excludes Person-only rows and retains legacy member reads",
  () => {
    const policy = migration.match(
      /create policy memberships_select_project_member[\s\S]*?;\s*(?=\n)/
    )?.[0];

    assert.ok(policy);
    assert.match(policy, /user_id is not null/);
    assert.match(policy, /role_id is not null/);
    assert.match(
      policy,
      /public\.is_project_member\(project_id\)/
    );
    assert.doesNotMatch(
      policy,
      /user_id is null|role_id is null/,
      "Person-only membership rows must not enter the VS-001 browser compatibility path."
    );
  }
);


test(
  "VS002-02 migration enforces the frozen role vocabulary and server-only access",
  () => {
    const frozenRoles = [
      "PROJECT_SPONSOR",
      "PROJECT_OWNER",
      "PROJECT_MANAGER",
      "PROJECT_MEMBER",
      "PROJECT_OBSERVER",
      "PROJECT_AUDITOR",
    ];

    for (const role of frozenRoles) {
      assert.match(
        migration,
        new RegExp(`'${role}'`)
      );
    }

    assert.doesNotMatch(
      migration,
      /TEMPORARY_PROJECT_MEMBER/
    );

    for (const legacyRole of [
      "PROJECT_LEAD",
      "CONTRIBUTOR",
      "REVIEWER",
      "VIEWER",
    ]) {
      assert.doesNotMatch(
        migration,
        new RegExp(`'${legacyRole}'`),
        "Legacy roles must not be guessed into the frozen vocabulary."
      );
    }

    assert.match(
      migration,
      /revoke all on table public\.authentication_identities from anon, authenticated;/
    );

    assert.doesNotMatch(
      migration,
      /grant select[^;]*authentication_identities[^;]*to authenticated;/
    );
  }
);
