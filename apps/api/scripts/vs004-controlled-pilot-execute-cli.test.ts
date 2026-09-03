import assert from "node:assert/strict";
import { test } from "node:test";

import {
  main,
  type ExecuteCliDependencies,
  type PilotCliProcess,
} from "./vs004-controlled-pilot-execute-cli";
import type {
  ExecuteCommandArguments,
  ExecuteCommandDependencies,
} from "./vs004-controlled-pilot-execute-command";
import type { ControlledPilotExecutionServices } from "./vs004-controlled-pilot-execution";
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
    argv: ["node", "execute-cli", ...argv],
    env: ENVIRONMENT,
    stdout: { write: (value: string) => { output.push(value); return true; } },
    stderr: { write: (value: string) => { errors.push(value); return true; } },
    exitCode: undefined,
    output,
    errors,
  };
}


function fileSystem(): PilotArtifactFileSystem {
  return {
    readUtf8: async () => "prepared-artifact",
    fileExists: async () => false,
    directoryIsWritable: async () => true,
    probeHardLinkSupport: async () => undefined,
    createExclusiveSibling: async () => ({
      tempPath: "result.tmp",
      close: async () => undefined,
    }),
    writeAndFlush: async () => undefined,
    publishNoReplace: async () => undefined,
    removeIfPresent: async () => undefined,
  };
}


function services(): ControlledPilotExecutionServices {
  return {} as ControlledPilotExecutionServices;
}


function runDependencies(
  overrides: Partial<ExecuteCliDependencies> = {},
): Partial<ExecuteCliDependencies> {
  return {
    loadConfiguration: () => configuration(),
    createFileSystem: () => fileSystem(),
    buildExecutionServices: () => services(),
    ...overrides,
  };
}


test("delegates process arguments to the canonical parser and command handler once", async () => {
  const process = processLike(["--prepared", "prepared.json", "--out", "result.json"]);
  const parsedArguments: string[][] = [];
  const handledArguments: ExecuteCommandArguments[] = [];
  const config = configuration();
  let handlerCalls = 0;

  await main(process, runDependencies({
    parseArguments: (argv) => {
      parsedArguments.push([...argv]);
      return {
        kind: "RUN",
        arguments: {
          preparedPath: "prepared.json",
          resultPath: "result.json",
        },
      };
    },
    loadConfiguration: (environment) => {
      assert.deepEqual(environment, ENVIRONMENT);
      return config;
    },
    runCommand: async (args, dependencies) => {
      handlerCalls += 1;
      handledArguments.push(args);
      assert.equal(dependencies.loadConfiguration(), config);
      return { exitCode: 0 };
    },
  }));

  assert.deepEqual(parsedArguments, [["--prepared", "prepared.json", "--out", "result.json"]]);
  assert.deepEqual(handledArguments, [{ preparedPath: "prepared.json", resultPath: "result.json" }]);
  assert.equal(handlerCalls, 1);
  assert.equal(process.exitCode, 0);
  assert.equal(process.errors.length, 0);
});


test("help is an early terminal path with no configuration, reservation, services, or handler construction", async () => {
  const process = processLike(["--help"]);
  let configurationLoads = 0;
  let fileSystemBuilds = 0;
  let serviceBuilds = 0;
  let handlerCalls = 0;

  await main(process, runDependencies({
    loadConfiguration: () => {
      configurationLoads += 1;
      throw new Error("secret-must-not-leak");
    },
    createFileSystem: () => {
      fileSystemBuilds += 1;
      throw new Error("filesystem-must-not-be-touched");
    },
    buildExecutionServices: () => {
      serviceBuilds += 1;
      throw new Error("services-must-not-build");
    },
    runCommand: async () => {
      handlerCalls += 1;
      throw new Error("handler-must-not-run");
    },
  }));

  assert.equal(process.exitCode, 0);
  assert.equal(configurationLoads, 0);
  assert.equal(fileSystemBuilds, 0);
  assert.equal(serviceBuilds, 0);
  assert.equal(handlerCalls, 0);
  assert.equal(process.errors.length, 0);
  assert.equal(process.output.join(""), "Usage: pilot:execute --prepared <prepared.json> --out <result.json>\n");
  assert.equal(process.output.join("").includes("secret-must-not-leak"), false);
});


test("passes a deferred execution-service factory and never builds services before reservation", async () => {
  const process = processLike(["--prepared", "prepared.json", "--out", "result.json"]);
  const events: string[] = [];
  const config = configuration();
  let serviceBuilds = 0;

  await main(process, runDependencies({
    loadConfiguration: () => config,
    buildExecutionServices: (received) => {
      serviceBuilds += 1;
      assert.equal(received, config);
      events.push("services-built");
      return services();
    },
    runCommand: async (_args, dependencies) => {
      events.push("handler-started");
      const loaded = dependencies.loadConfiguration();
      const reservation = await dependencies.reserveOutputs("result.json", "result.json.failed.json");
      events.push("outputs-reserved");
      dependencies.buildExecutionServices(loaded);
      events.push("factory-invoked-by-handler");
      await reservation.releaseUnused();
      return { exitCode: 0 };
    },
  }));

  assert.deepEqual(events, [
    "handler-started",
    "outputs-reserved",
    "services-built",
    "factory-invoked-by-handler",
  ]);
  assert.equal(serviceBuilds, 1);
  assert.equal(process.exitCode, 0);
});


test("maps a handler failure to the process exit code without independently deriving status", async () => {
  const process = processLike(["--prepared", "prepared.json", "--out", "result.json"]);
  let handlerCalls = 0;

  await main(process, runDependencies({
    runCommand: async (_args, dependencies) => {
      handlerCalls += 1;
      assert.equal(typeof dependencies.reserveOutputs, "function");
      assert.equal(typeof dependencies.buildExecutionServices, "function");
      return { exitCode: 1 };
    },
  }));

  assert.equal(handlerCalls, 1);
  assert.equal(process.exitCode, 1);
});


test("rejects option-like prepared paths through the existing parser before configuration or reservation", async () => {
  const process = processLike(["--prepared", "--secret-must-not-leak", "--out", "result.json"]);
  let configurationLoads = 0;
  let fileSystemBuilds = 0;
  let handlerCalls = 0;

  await main(process, runDependencies({
    loadConfiguration: () => {
      configurationLoads += 1;
      throw new Error("configuration-must-not-load");
    },
    createFileSystem: () => {
      fileSystemBuilds += 1;
      throw new Error("filesystem-must-not-build");
    },
    runCommand: async () => {
      handlerCalls += 1;
      throw new Error("handler-must-not-run");
    },
  }));

  assert.equal(process.exitCode, 1);
  assert.equal(configurationLoads, 0);
  assert.equal(fileSystemBuilds, 0);
  assert.equal(handlerCalls, 0);
  assert.equal(process.output.join("").includes("secret-must-not-leak"), false);
  assert.equal(process.errors.join("").includes("secret-must-not-leak"), false);
});


test("uses concise safe stderr for top-level failures without printing the caught error", async () => {
  const process = processLike(["--prepared", "prepared.json", "--out", "result.json"]);

  await main(process, runDependencies({
    runCommand: async () => {
      throw new Error("SUPABASE_SECRET_KEY=secret-must-not-leak stack must-not-leak");
    },
  }));

  assert.equal(process.exitCode, 1);
  assert.equal(process.errors.join(""), "EXECUTE FAILED\n");
  assert.equal(process.errors.join("").includes("secret-must-not-leak"), false);
  assert.equal(process.errors.join("").includes("stack"), false);
});
