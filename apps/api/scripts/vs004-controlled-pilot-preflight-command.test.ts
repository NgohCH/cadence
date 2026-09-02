import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  computeManifestHash,
  validatePilotManifest,
  type ValidatedPilotManifest,
} from "./vs004-pilot-manifest";
import type {
  ControlledPilotObservationSources,
  PreparedPilotExecution,
} from "./vs004-controlled-pilot-preflight";
import type { PilotPreflightPlan, PilotRuntimeTarget } from "./vs004-preflight";
import type { ControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";
import {
  parsePreparedPilotExecutionArtifact,
  serializePreparedPilotExecutionArtifact,
} from "./vs004-controlled-pilot-artifact";
import { preparePilotExecution } from "./vs004-controlled-pilot-preflight";
import {
  parsePreflightArguments,
  runPreflightCommand,
  type PreflightCommandArguments,
  type PreflightCommandDependencies,
} from "./vs004-controlled-pilot-preflight-command";


const RUN_ID = "00449000-0000-4000-8000-000000000201";
const SECRET = "VS004_SECRET_MUST_NOT_LEAK";
const PASSWORD = "VS004_PASSWORD_MUST_NOT_LEAK";


function manifestText(): string {
  return readFileSync(
    resolve(__dirname, "vs004-pilot.example.json"),
    "utf8",
  );
}


function manifest(): ValidatedPilotManifest {
  return validatePilotManifest(JSON.parse(manifestText()));
}


function prepared(): PreparedPilotExecution {
  const pilotManifest = manifest();
  const manifestHash = computeManifestHash(pilotManifest);
  const target = {
    environment: pilotManifest.target.environment,
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseProjectRef: null,
    projectId: pilotManifest.project.id,
    safeTargetMarker: pilotManifest.target.safeTargetMarker,
  };
  const plan: PilotPreflightPlan = {
    manifestId: pilotManifest.manifestId,
    manifestHash,
    target: {
      environment: pilotManifest.target.environment,
      projectId: target.projectId,
      safeTargetMarker: target.safeTargetMarker,
    },
    operatorPersonId: pilotManifest.operator.personId,
    runCorrelationId: RUN_ID,
    operations: [],
  };
  return {
    manifestId: pilotManifest.manifestId,
    manifestHash,
    target,
    operatorPersonId: pilotManifest.operator.personId,
    runCorrelationId: RUN_ID,
    validatedManifest: pilotManifest,
    observedEvidence: {
      observedAt: "2026-09-02T00:00:00.000Z",
      userCount: pilotManifest.users.length,
      personCount: 1,
      cadenceUserCount: 0,
      authenticationIdentityCount: 0,
      authAccountCount: 0,
      projectCount: 0,
      membershipCount: 0,
      roleAssignmentCount: 0,
      protectedTransferCount: 0,
    },
    preflightPlan: plan,
  };
}


function configuration(): ControlledPilotRuntimeConfiguration {
  const pilotManifest = manifest();
  const runtimeTarget: PilotRuntimeTarget = {
    cadenceEnv: "local",
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseProjectRef: null,
    projectId: pilotManifest.project.id,
    safeTargetMarker: pilotManifest.target.safeTargetMarker,
  };
  return {
    runtimeTarget,
    supabaseSecretKey: SECRET,
    firstAccountPassword: PASSWORD,
  };
}


function readOnlySources(): ControlledPilotObservationSources {
  return {} as ControlledPilotObservationSources;
}


function commandArguments(): PreflightCommandArguments {
  return {
    manifestPath: "C:/pilot/manifest.json",
    outputPath: "C:/pilot/prepared.json",
  };
}


function dependencies(
  overrides: Partial<PreflightCommandDependencies> = {},
): PreflightCommandDependencies {
  return {
    readManifest: async () => manifestText(),
    loadConfiguration: () => configuration(),
    observationSources: readOnlySources(),
    prepare: async () => prepared(),
    publishPrepared: async () => undefined,
    createRunCorrelationId: () => RUN_ID,
    writeLine: () => undefined,
    ...overrides,
  };
}


test("parses the exact preflight manifest and output arguments", () => {
  assert.deepEqual(
    parsePreflightArguments([
      "--manifest",
      "manifest.json",
      "--out",
      "prepared.json",
    ]),
    {
      kind: "RUN",
      arguments: {
        manifestPath: "manifest.json",
        outputPath: "prepared.json",
      },
    },
  );
  assert.deepEqual(parsePreflightArguments(["--help"]), { kind: "HELP" });
});


test("rejects missing, duplicate, unknown, and extra preflight arguments", () => {
  for (const argv of [
    [],
    ["--manifest"],
    ["--out"],
    ["--manifest", "manifest.json"],
    ["--out", "prepared.json"],
    ["--manifest", "manifest.json", "--manifest", "other.json", "--out", "prepared.json"],
    ["--manifest", "manifest.json", "--out", "prepared.json", "--force"],
    ["--unknown", "value"],
    ["--manifest", "", "--out", "prepared.json"],
  ]) {
    assert.throws(() => parsePreflightArguments(argv));
  }
});


test("does not echo arbitrary argument values in parser errors", () => {
  assert.throws(
    () => parsePreflightArguments([SECRET]),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal(
        (error as Error).message.includes(SECRET),
        false,
      );
      return true;
    },
  );
});


test("rejects option-like tokens in preflight path value positions", () => {
  for (const argv of [
    ["--manifest", "--force", "--out", "prepared.json"],
    ["--manifest", "--execute-after-preflight", "--out", "prepared.json"],
    ["--manifest", "--anything", "--out", "prepared.json"],
  ]) {
    assert.throws(
      () => parsePreflightArguments(argv),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error).message.includes(argv[1]!), false);
        return true;
      },
    );
  }
});


test("runs read-only preflight in order and publishes the exact prepared payload", async () => {
  const events: string[] = [];
  const original = prepared();
  const configured = configuration();
  let receivedInput: unknown;
  let published: string | undefined;
  const result = await runPreflightCommand(commandArguments(), dependencies({
    readManifest: async () => {
      events.push("read-manifest");
      return manifestText();
    },
    loadConfiguration: () => {
      events.push("load-configuration");
      return configured;
    },
    prepare: async (input) => {
      events.push("prepare-04a");
      receivedInput = input;
      return original;
    },
    publishPrepared: async (_path, content) => {
      events.push("publish-prepared");
      published = content;
    },
    createRunCorrelationId: () => {
      events.push("correlation-id");
      return RUN_ID;
    },
  }));

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.prepared, original);
  assert.deepEqual(events, [
    "read-manifest",
    "load-configuration",
    "correlation-id",
    "prepare-04a",
    "publish-prepared",
  ]);
  assert.deepEqual(
    parsePreparedPilotExecutionArtifact(published!),
    original,
  );
  assert.equal(
    (receivedInput as { readonly runtimeTarget: PilotRuntimeTarget }).runtimeTarget,
    configured.runtimeTarget,
  );
});


test("generates one correlation ID and invokes 04A exactly once", async () => {
  let correlationCalls = 0;
  let prepareCalls = 0;
  const result = await runPreflightCommand(commandArguments(), dependencies({
    createRunCorrelationId: () => {
      correlationCalls += 1;
      return RUN_ID;
    },
    prepare: async (input) => {
      prepareCalls += 1;
      assert.equal(input.runCorrelationId, RUN_ID);
      return prepared();
    },
  }));

  assert.equal(result.exitCode, 0);
  assert.equal(correlationCalls, 1);
  assert.equal(prepareCalls, 1);
});


test("keeps the observation-only dependency surface and never constructs execution services", async () => {
  let publishCalls = 0;
  const observationSources = readOnlySources();
  const dependenciesWithForbiddenExecution = dependencies({
    observationSources,
    publishPrepared: async () => {
      publishCalls += 1;
    },
  });
  const forbiddenExecutionBuilder = () => {
    throw new Error("execution runtime must not be constructed");
  };
  Object.defineProperty(dependenciesWithForbiddenExecution, "buildExecution", {
    value: forbiddenExecutionBuilder,
  });

  const result = await runPreflightCommand(
    commandArguments(),
    dependenciesWithForbiddenExecution,
  );

  assert.equal(result.exitCode, 0);
  assert.equal(publishCalls, 1);
  assert.equal("buildExecution" in dependenciesWithForbiddenExecution, true);
});


test("passes the independently configured project target unchanged to 04A", async () => {
  const targetSeen: PilotRuntimeTarget[] = [];
  const configured = configuration();
  const result = await runPreflightCommand(commandArguments(), dependencies({
    loadConfiguration: () => configured,
    prepare: async (input) => {
      targetSeen.push(input.runtimeTarget);
      return prepared();
    },
  }));

  assert.equal(result.exitCode, 0);
  assert.equal(targetSeen[0], configured.runtimeTarget);
  assert.notEqual(targetSeen[0]?.projectId, "supabase-project-ref");
});


test("invalid manifest fails before 04A observation and publication", async () => {
  let publishCalls = 0;
  const observationSources = new Proxy(readOnlySources(), {
    get() {
      throw new Error("observation must not run");
    },
  });
  const result = await runPreflightCommand(commandArguments(), dependencies({
    readManifest: async () => "{}",
    observationSources,
    prepare: preparePilotExecution,
    publishPrepared: async () => {
      publishCalls += 1;
    },
  }));

  assert.equal(result.exitCode, 1);
  assert.equal(publishCalls, 0);
});


test("invalid runtime configuration fails before observation and 04A", async () => {
  let prepareCalls = 0;
  let publishCalls = 0;
  const result = await runPreflightCommand(commandArguments(), dependencies({
    loadConfiguration: () => {
      throw new Error(`invalid configuration with ${SECRET}`);
    },
    prepare: async () => {
      prepareCalls += 1;
      return prepared();
    },
    publishPrepared: async () => {
      publishCalls += 1;
    },
  }));

  assert.equal(result.exitCode, 1);
  assert.equal(prepareCalls, 0);
  assert.equal(publishCalls, 0);
});


test("04A failure produces no prepared artifact and no execution runtime", async () => {
  let publishCalls = 0;
  const result = await runPreflightCommand(commandArguments(), dependencies({
    prepare: async () => {
      throw new Error("preflight failed with provider details");
    },
    publishPrepared: async () => {
      publishCalls += 1;
    },
  }));
  assert.equal(result.exitCode, 1);
  assert.equal(publishCalls, 0);
});


test("preserves an existing output when no-replace publication rejects", async () => {
  const existing = "existing-prepared-bytes";
  let output = existing;
  const result = await runPreflightCommand(commandArguments(), dependencies({
    publishPrepared: async () => {
      throw new Error("output already exists");
    },
  }));

  assert.equal(result.exitCode, 1);
  assert.equal(output, existing);
});


test("writes only credential-free artifact and summary output", async () => {
  const lines: string[] = [];
  let artifact = "";
  const result = await runPreflightCommand(commandArguments(), dependencies({
    publishPrepared: async (_path, content) => {
      artifact = content;
    },
    writeLine: (line) => lines.push(line),
  }));

  assert.equal(result.exitCode, 0);
  assert.doesNotMatch(artifact, new RegExp(`${SECRET}|${PASSWORD}`));
  assert.doesNotMatch(lines.join("\n"), new RegExp(`${SECRET}|${PASSWORD}`));
  assert.ok(lines.includes("PREPARED — NOT EXECUTED"));
  assert.ok(lines.includes("NO MUTATIONS PERFORMED"));
});


test("does not publish before successful 04A completion", async () => {
  const events: string[] = [];
  const result = await runPreflightCommand(commandArguments(), dependencies({
    prepare: async () => {
      events.push("prepare-start");
      await Promise.resolve();
      events.push("prepare-success");
      return prepared();
    },
    publishPrepared: async () => {
      events.push("publish");
    },
  }));

  assert.equal(result.exitCode, 0);
  assert.deepEqual(events, ["prepare-start", "prepare-success", "publish"]);
});


test("reports a safe nonzero result without serializing caught credentials", async () => {
  const lines: string[] = [];
  const result = await runPreflightCommand(commandArguments(), dependencies({
    prepare: async () => {
      throw new Error(`provider failed ${SECRET} ${PASSWORD}`);
    },
    writeLine: (line) => lines.push(line),
  }));

  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(lines.join("\n"), new RegExp(`${SECRET}|${PASSWORD}`));
});


test("publishes no prepared artifact when serialization rejects an invalid 04A result", async () => {
  let publishCalls = 0;
  const invalidPrepared = { ...prepared(), manifestHash: "forged" };
  const result = await runPreflightCommand(commandArguments(), dependencies({
    prepare: async () => invalidPrepared,
    publishPrepared: async () => {
      publishCalls += 1;
    },
  }));

  assert.equal(result.exitCode, 1);
  assert.equal(publishCalls, 0);
});


test("uses the committed prepared serializer rather than reconstructing its envelope", () => {
  const original = prepared();
  const serialized = serializePreparedPilotExecutionArtifact(original);
  assert.deepEqual(
    parsePreparedPilotExecutionArtifact(serialized),
    original,
  );
});
