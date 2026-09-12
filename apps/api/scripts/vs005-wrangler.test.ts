import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

import { resolveCadenceRepositoryRoot } from "./cadence-operator-path";
import {
  resolveCadenceWranglerCommand,
  resolveCadenceWranglerExecutable,
} from "./vs005-wrangler";

test("resolves the repository-controlled Wrangler without ambient PATH", () => {
  const repositoryRoot = resolveCadenceRepositoryRoot();
  const executable = resolveCadenceWranglerExecutable(repositoryRoot);
  const expectedSuffix = "apps/runtime-cloudflare/node_modules/wrangler/bin/wrangler.js";

  assert.equal(executable, resolve(repositoryRoot, expectedSuffix));

  const command = resolveCadenceWranglerCommand(["wrangler", "--version"], repositoryRoot);
  assert.deepEqual(command, [process.execPath, executable, "--version"]);

  const result = spawnSync(command[0], command.slice(1), {
    cwd: repositoryRoot,
    env: { ...process.env, PATH: "" },
    encoding: "utf8",
    shell: false,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^4\.127\.1\s*$/m);
});
