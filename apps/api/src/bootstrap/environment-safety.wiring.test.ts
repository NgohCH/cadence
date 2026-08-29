import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import test from "node:test";


function readSource(
  relativePath: string
): string {
  return readFileSync(
    resolve(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}


function requireIndex(
  source: string,
  value: string,
  description: string
): number {
  const index =
    source.indexOf(
      value
    );

  assert.notEqual(
    index,
    -1,
    `${description} was not found.`
  );

  return index;
}


test(
  "API validates Cadence environment before constructing any Supabase-backed infrastructure",
  () => {
    const source =
      readSource(
        "src/server.ts"
      );

    const guardIndex =
      requireIndex(
        source,
        "validateCadenceEnvironmentSafety({",
        "API environment safety guard"
      );

    const authProviderIndex =
      requireIndex(
        source,
        "new SupabaseAuthProvider(",
        "Supabase auth provider construction"
      );

    const databaseClientIndex =
      requireIndex(
        source,
        "createClient(",
        "Supabase database client construction"
      );

    assert.ok(
      guardIndex <
        authProviderIndex,
      "server.ts must validate environment safety before constructing SupabaseAuthProvider."
    );

    assert.ok(
      guardIndex <
        databaseClientIndex,
      "server.ts must validate environment safety before creating its database client."
    );

    assert.match(
      source,
      /process\.env\.CADENCE_ENV/
    );

    assert.match(
      source,
      /process\.env\.CADENCE_SUPABASE_PROJECT_REF/
    );
  }
);


test(
  "worker validates Cadence environment before creating its Supabase database client",
  () => {
    const source =
      readSource(
        "src/worker.ts"
      );

    const guardIndex =
      requireIndex(
        source,
        "validateCadenceEnvironmentSafety({",
        "Worker environment safety guard"
      );

    const databaseClientIndex =
      requireIndex(
        source,
        "createClient(",
        "Worker Supabase database client construction"
      );

    assert.ok(
      guardIndex <
        databaseClientIndex,
      "worker.ts must validate environment safety before creating its Supabase database client."
    );

    assert.match(
      source,
      /process\.env\.CADENCE_ENV/
    );

    assert.match(
      source,
      /process\.env\.CADENCE_SUPABASE_PROJECT_REF/
    );
  }
);
