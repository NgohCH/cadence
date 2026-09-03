import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { parseExecuteArguments } from "./vs004-controlled-pilot-execute-command";
import { parsePreflightArguments } from "./vs004-controlled-pilot-preflight-command";


type PackageManifest = {
  readonly scripts?: Record<string, string>;
};


const apiPackage = readPackage(resolve(process.cwd(), "package.json"));
const rootPackage = readPackage(resolve(process.cwd(), "..", "..", "package.json"));


test("wires the exact API and root pilot commands to the Task 10 entrypoints", () => {
  assert.equal(
    apiPackage.scripts?.["pilot:preflight"],
    "node --import tsx scripts/vs004-controlled-pilot-preflight-cli.ts",
  );
  assert.equal(
    apiPackage.scripts?.["pilot:execute"],
    "node --import tsx scripts/vs004-controlled-pilot-execute-cli.ts",
  );
  assert.equal(
    rootPackage.scripts?.["pilot:preflight"],
    "npm --prefix apps/api run pilot:preflight --",
  );
  assert.equal(
    rootPackage.scripts?.["pilot:execute"],
    "npm --prefix apps/api run pilot:execute --",
  );
});


test("keeps package wiring transport-only and preserves Task 9A argument authority", () => {
  const scripts = [
    apiPackage.scripts?.["pilot:preflight"],
    apiPackage.scripts?.["pilot:execute"],
    rootPackage.scripts?.["pilot:preflight"],
    rootPackage.scripts?.["pilot:execute"],
  ].join("\n");

  for (const prohibited of [
    "preparePilotExecution",
    "executeControlledPilot",
    "buildPilotPreflightPlan",
    "buildControlledPilotExecutionServices",
    "--yes",
    "--force",
    "--execute-after-preflight",
  ]) {
    assert.equal(scripts.includes(prohibited), false, `package wiring contains ${prohibited}`);
  }

  assert.deepEqual(
    parsePreflightArguments(["--manifest", "manifest.json", "--out", "prepared.json"]),
    {
      kind: "RUN",
      arguments: { manifestPath: "manifest.json", outputPath: "prepared.json" },
    },
  );
  assert.deepEqual(
    parseExecuteArguments(["--prepared", "prepared.json", "--out", "result.json"]),
    {
      kind: "RUN",
      arguments: { preparedPath: "prepared.json", resultPath: "result.json" },
    },
  );
  assert.throws(() => parseExecuteArguments(["--manifest", "manifest.json", "--out", "result.json"]));
  assert.throws(() => parsePreflightArguments(["--manifest", "--secret", "--out", "prepared.json"]));
});


function readPackage(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}
