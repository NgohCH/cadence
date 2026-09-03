import assert from "node:assert/strict";
import { test } from "node:test";

import {
  main,
  type PilotCliProcess,
  type PreflightCliDependencies,
} from "./vs004-controlled-pilot-preflight-cli";
import type {
  PreflightCommandArguments,
  PreflightCommandDependencies,
} from "./vs004-controlled-pilot-preflight-command";
import type { ControlledPilotObservationSources } from "./vs004-controlled-pilot-preflight";
import type { ControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";
import type { PilotArtifactFileSystem } from "./vs004-controlled-pilot-file";


const ENVIRONMENT = {
  CADENCE_ENV: "local",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "secret-must-not-leak",
  CADENCE_SAFE_TARGET_MARKER: "safe-marker",
  CADENCE_PILOT_PROJECT_ID: "pilot-project",
};


function configuration(): ControlledPilotRuntimeConfiguration {
  return {
    runtimeTarget: {
      cadenceEnv: "local",
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseProjectRef: undefined,
      projectId: "pilot-project",
      safeTargetMarker: "safe-marker",
    },
    supabaseSecretKey: "secret-must-not-leak",
    firstAccountPassword: "password-must-not-leak",
  };
}


function processLike(argv: readonly string[]): PilotCliProcess & { readonly output: string[]; readonly errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    argv: ["node", "preflight-cli", ...argv],
    env: ENVIRONMENT,
    stdout: { write: (value: string) => { output.push(value); return true; } },
    stderr: { write: (value: string) => { errors.push(value); return true; } },
    exitCode: undefined,
    output,
    errors,
  };
}


function observationSources(): ControlledPilotObservationSources {
  return {} as ControlledPilotObservationSources;
}


function fileSystem(): PilotArtifactFileSystem {
  return {
    readUtf8: async () => "manifest",
    fileExists: async () => false,
    directoryIsWritable: async () => true,
    probeHardLinkSupport: async () => undefined,
    createExclusiveSibling: async () => ({
      tempPath: "prepared.tmp",
      close: async () => undefined,
    }),
    writeAndFlush: async () => undefined,
    publishNoReplace: async () => undefined,
    removeIfPresent: async () => undefined,
  };
}


function runDependencies(
  overrides: Partial<PreflightCliDependencies> = {},
): Partial<PreflightCliDependencies> {
  return {
    loadConfiguration: () => configuration(),
    buildObservationRuntime: () => observationSources(),
    createFileSystem: () => fileSystem(),
    ...overrides,
  };
}


test("delegates process arguments to the canonical parser and command handler once", async () => {
  const process = processLike(["--manifest", "manifest.json", "--out", "prepared.json"]);
  const parsedArguments: string[][] = [];
  const handledArguments: PreflightCommandArguments[] = [];
  const sources = observationSources();
  const config = configuration();
  let configurationLoads = 0;
  let observationBuilds = 0;
  let handlerCalls = 0;

  const dependencies = runDependencies({
    parseArguments: (argv) => {
      parsedArguments.push([...argv]);
      return {
        kind: "RUN",
        arguments: {
          manifestPath: "manifest.json",
          outputPath: "prepared.json",
        },
      };
    },
    loadConfiguration: (environment) => {
      configurationLoads += 1;
      assert.deepEqual(environment, ENVIRONMENT);
      return config;
    },
    buildObservationRuntime: (received) => {
      observationBuilds += 1;
      assert.equal(received, config);
      return sources;
    },
    runCommand: async (args, commandDependencies) => {
      handlerCalls += 1;
      handledArguments.push(args);
      assert.equal(commandDependencies.observationSources, sources);
      assert.equal(commandDependencies.loadConfiguration(), config);
      return { exitCode: 0 };
    },
  });

  await main(process, dependencies);

  assert.deepEqual(parsedArguments, [["--manifest", "manifest.json", "--out", "prepared.json"]]);
  assert.deepEqual(handledArguments, [{ manifestPath: "manifest.json", outputPath: "prepared.json" }]);
  assert.equal(handlerCalls, 1);
  assert.equal(configurationLoads, 1);
  assert.equal(observationBuilds, 1);
  assert.equal(process.exitCode, 0);
  assert.deepEqual(process.errors, []);
});


test("help is an early terminal path with no configuration, observation, filesystem, or handler construction", async () => {
  const process = processLike(["--help"]);
  let configurationLoads = 0;
  let observationBuilds = 0;
  let fileSystemBuilds = 0;
  let handlerCalls = 0;

  await main(process, runDependencies({
    loadConfiguration: () => {
      configurationLoads += 1;
      throw new Error("secret-must-not-leak");
    },
    buildObservationRuntime: () => {
      observationBuilds += 1;
      throw new Error("database-must-not-be-read");
    },
    createFileSystem: () => {
      fileSystemBuilds += 1;
      throw new Error("filesystem-must-not-be-touched");
    },
    runCommand: async () => {
      handlerCalls += 1;
      throw new Error("handler-must-not-run");
    },
  }));

  assert.equal(process.exitCode, 0);
  assert.equal(configurationLoads, 0);
  assert.equal(observationBuilds, 0);
  assert.equal(fileSystemBuilds, 0);
  assert.equal(handlerCalls, 0);
  assert.equal(process.errors.length, 0);
  assert.equal(process.output.join(""), "Usage: pilot:preflight --manifest <manifest.json> --out <prepared.json>\n");
  assert.equal(process.output.join("").includes("secret-must-not-leak"), false);
});


test("maps the handler exit code and composes the committed filesystem adapters", async () => {
  const process = processLike(["--manifest", "manifest.json", "--out", "prepared.json"]);
  const calls: string[] = [];
  const fs = fileSystem();

  await main(process, runDependencies({
    createFileSystem: () => fs,
    runCommand: async (_args, dependencies) => {
      await dependencies.readManifest("manifest.json");
      await dependencies.publishPrepared("prepared.json", "prepared-content");
      calls.push("handled");
      return { exitCode: 1 };
    },
  }));

  assert.deepEqual(calls, ["handled"]);
  assert.equal(process.exitCode, 1);
  assert.equal(process.errors.length, 0);
});


test("rejects option-like path values through the existing parser before runtime composition", async () => {
  const process = processLike(["--manifest", "--secret-must-not-leak", "--out", "prepared.json"]);
  let configurationLoads = 0;
  let observationBuilds = 0;
  let handlerCalls = 0;

  await main(process, runDependencies({
    loadConfiguration: () => {
      configurationLoads += 1;
      throw new Error("configuration-must-not-load");
    },
    buildObservationRuntime: () => {
      observationBuilds += 1;
      throw new Error("observation-must-not-build");
    },
    runCommand: async () => {
      handlerCalls += 1;
      throw new Error("handler-must-not-run");
    },
  }));

  assert.equal(process.exitCode, 1);
  assert.equal(configurationLoads, 0);
  assert.equal(observationBuilds, 0);
  assert.equal(handlerCalls, 0);
  assert.equal(process.output.join("").includes("secret-must-not-leak"), false);
  assert.equal(process.errors.join("").includes("secret-must-not-leak"), false);
});


test("uses concise safe stderr for top-level failures without printing the caught error", async () => {
  const process = processLike(["--manifest", "manifest.json", "--out", "prepared.json"]);

  await main(process, runDependencies({
    loadConfiguration: () => {
      throw new Error("SUPABASE_SECRET_KEY=secret-must-not-leak stack must-not-leak");
    },
  }));

  assert.equal(process.exitCode, 1);
  assert.equal(process.errors.join(""), "PREFLIGHT FAILED\n");
  assert.equal(process.errors.join("").includes("secret-must-not-leak"), false);
  assert.equal(process.errors.join("").includes("stack"), false);
});
