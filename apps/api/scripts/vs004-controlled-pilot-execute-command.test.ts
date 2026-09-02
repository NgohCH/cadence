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
  parsePilotExecutionFailureArtifact,
  parsePilotExecutionResultArtifact,
  serializePreparedPilotExecutionArtifact,
  type PilotExecutionFailureEvidence,
} from "./vs004-controlled-pilot-artifact";
import {
  ControlledPilotExecutionError,
  type ControlledPilotExecutionServices,
  type PilotExecutionOutcome,
  type PilotExecutionResult,
} from "./vs004-controlled-pilot-execution";
import type { ExecutionOutputReservation } from "./vs004-controlled-pilot-file";
import {
  parseExecuteArguments,
  runExecuteCommand,
  type ExecuteCommandArguments,
  type ExecuteCommandDependencies,
} from "./vs004-controlled-pilot-execute-command";


const RUN_ID = "00449000-0000-4000-8000-000000000301";
const SECRET = "VS004_EXECUTE_SECRET_MUST_NOT_LEAK";
const PASSWORD = "VS004_EXECUTE_PASSWORD_MUST_NOT_LEAK";
const RESULT_PATH = "C:/pilot/result.json";
const PREPARED_PATH = "C:/pilot/prepared.json";


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
  } as const;
  const plan: PilotPreflightPlan = {
    manifestId: pilotManifest.manifestId,
    manifestHash,
    target: {
      environment: target.environment,
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


function result(): PilotExecutionResult {
  const pilotPrepared = prepared();
  const outcome: PilotExecutionOutcome = {
    resourceKey: "project:00440000-0000-4000-8000-000000000001",
    plannedOperation: "REUSE",
    owningModule: "Projects",
    resourceId: "00440000-0000-4000-8000-000000000001",
    actualResult: "REUSED",
    operatorPersonId: pilotPrepared.operatorPersonId,
    runCorrelationId: RUN_ID,
  };
  return {
    manifestId: pilotPrepared.manifestId,
    manifestHash: pilotPrepared.manifestHash,
    runCorrelationId: RUN_ID,
    target: pilotPrepared.target,
    startedAt: "2026-09-02T01:00:00.000Z",
    completedAt: "2026-09-02T01:01:00.000Z",
    outcomes: [outcome],
  };
}


function preparedText(): string {
  return serializePreparedPilotExecutionArtifact(prepared());
}


class FakeReservation implements ExecutionOutputReservation {
  readonly successPath = RESULT_PATH;
  readonly failurePath = `${RESULT_PATH}.failed.json`;
  readonly events: string[] = [];
  successContent: string | undefined;
  failureContent: string | undefined;
  successFailure: Error | undefined;
  failureFailure: Error | undefined;
  releaseFailure: Error | undefined;
  releaseCalls = 0;

  async publishSuccess(content: string): Promise<void> {
    this.events.push("publish-success");
    if (this.successFailure) throw this.successFailure;
    this.successContent = content;
  }

  async publishFailure(content: string): Promise<void> {
    this.events.push("publish-failure");
    if (this.failureFailure) throw this.failureFailure;
    this.failureContent = content;
  }

  async releaseUnused(): Promise<void> {
    this.events.push("release-unused");
    this.releaseCalls += 1;
    if (this.releaseFailure) throw this.releaseFailure;
  }
}


function services(): ControlledPilotExecutionServices {
  return {} as ControlledPilotExecutionServices;
}


function commandArguments(): ExecuteCommandArguments {
  return {
    preparedPath: PREPARED_PATH,
    resultPath: RESULT_PATH,
  };
}


function dependencies(
  reservation: FakeReservation = new FakeReservation(),
  overrides: Partial<ExecuteCommandDependencies> = {},
): ExecuteCommandDependencies {
  return {
    readPrepared: async () => preparedText(),
    loadConfiguration: () => configuration(),
    reserveOutputs: async () => reservation,
    buildExecutionServices: () => services(),
    execute: async () => result(),
    now: () => "2026-09-02T01:02:00.000Z",
    writeLine: () => undefined,
    ...overrides,
  };
}


function staleError(completedOutcomes: readonly PilotExecutionOutcome[] = []): ControlledPilotExecutionError {
  const pilotPrepared = prepared();
  return new ControlledPilotExecutionError(
    "STALE_PLAN",
    "stale provider details must not escape",
    {
      manifestId: pilotPrepared.manifestId,
      manifestHash: pilotPrepared.manifestHash,
      runCorrelationId: RUN_ID,
      failedOperation: { resourceKey: "project:stale", kind: "REUSE" },
      completedOutcomes,
    },
  );
}


test("parses prepared and result arguments and accepts exclusive help", () => {
  assert.deepEqual(
    parseExecuteArguments(["--prepared", "prepared.json", "--out", "result.json"]),
    {
      kind: "RUN",
      arguments: { preparedPath: "prepared.json", resultPath: "result.json" },
    },
  );
  assert.deepEqual(parseExecuteArguments(["--help"]), { kind: "HELP" });
});


test("rejects manifest, force, yes, duplicate, missing, unknown, and extra arguments", () => {
  for (const argv of [
    ["--manifest", "manifest.json", "--out", "result.json"],
    ["--force"],
    ["--yes"],
    ["--execute-after-preflight"],
    [],
    ["--prepared"],
    ["--out"],
    ["--prepared", "prepared.json"],
    ["--out", "result.json"],
    ["--prepared", "prepared.json", "--prepared", "other.json", "--out", "result.json"],
    ["--prepared", "prepared.json", "--out", "result.json", "extra"],
    ["--prepared", "", "--out", "result.json"],
    ["--unknown", "value"],
  ]) {
    assert.throws(() => parseExecuteArguments(argv));
  }
});


test("does not echo arbitrary argument values in parser errors", () => {
  assert.throws(
    () => parseExecuteArguments([SECRET]),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message.includes(SECRET), false);
      return true;
    },
  );
});


test("rejects malformed prepared transport before configuration, reservation, services, or execution", async () => {
  let configurationCalls = 0;
  let reservationCalls = 0;
  let serviceCalls = 0;
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    readPrepared: async () => "{",
    loadConfiguration: () => {
      configurationCalls += 1;
      return configuration();
    },
    reserveOutputs: async () => {
      reservationCalls += 1;
      return new FakeReservation();
    },
    buildExecutionServices: () => {
      serviceCalls += 1;
      return services();
    },
    execute: async () => {
      executeCalls += 1;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(configurationCalls, 0);
  assert.equal(reservationCalls, 0);
  assert.equal(serviceCalls, 0);
  assert.equal(executeCalls, 0);
});


test("rejects wrong, missing, and future prepared versions before runtime composition", async () => {
  for (const mutate of [
    (envelope: Record<string, unknown>) => { envelope.artifactType = "wrong"; },
    (envelope: Record<string, unknown>) => { delete envelope.formatVersion; },
    (envelope: Record<string, unknown>) => { envelope.formatVersion = 2; },
  ]) {
    const envelope = JSON.parse(preparedText()) as Record<string, unknown>;
    mutate(envelope);
    let configurationCalls = 0;
    let reservationCalls = 0;
    const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
      readPrepared: async () => JSON.stringify(envelope),
      loadConfiguration: () => {
        configurationCalls += 1;
        return configuration();
      },
      reserveOutputs: async () => {
        reservationCalls += 1;
        return new FakeReservation();
      },
    }));
    assert.equal(resultValue.exitCode, 1);
    assert.equal(configurationCalls, 0);
    assert.equal(reservationCalls, 0);
  }
});


test("rejects unsupported prepared operations before runtime composition", async () => {
  const envelope = JSON.parse(preparedText()) as {
    preparedExecution: { preflightPlan: { operations: unknown[] } };
  };
  envelope.preparedExecution.preflightPlan.operations = [{ kind: "DELETE", resourceKey: "forged" }];
  let reservationCalls = 0;
  let executionCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    readPrepared: async () => JSON.stringify(envelope),
    reserveOutputs: async () => {
      reservationCalls += 1;
      return new FakeReservation();
    },
    execute: async () => {
      executionCalls += 1;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(reservationCalls, 0);
  assert.equal(executionCalls, 0);
});


test("reserves both output paths before building services or invoking 04B", async () => {
  const events: string[] = [];
  const reservation = new FakeReservation();
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    readPrepared: async () => {
      events.push("read");
      return preparedText();
    },
    loadConfiguration: () => {
      events.push("configuration");
      return configuration();
    },
    reserveOutputs: async (resultPath, failurePath) => {
      events.push(`reserve:${resultPath}:${failurePath}`);
      return reservation;
    },
    buildExecutionServices: () => {
      events.push("services");
      return services();
    },
    execute: async () => {
      events.push("execute");
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 0);
  assert.deepEqual(events, [
    "read",
    "configuration",
    `reserve:${RESULT_PATH}:${RESULT_PATH}.failed.json`,
    "services",
    "execute",
  ]);
});


test("existing result output fails before service construction or execution", async () => {
  let serviceCalls = 0;
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    reserveOutputs: async (resultPath) => {
      assert.equal(resultPath, RESULT_PATH);
      throw new Error("existing result output");
    },
    buildExecutionServices: () => {
      serviceCalls += 1;
      return services();
    },
    execute: async () => {
      executeCalls += 1;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(serviceCalls, 0);
  assert.equal(executeCalls, 0);
});


test("existing failure output fails before service construction or execution", async () => {
  let serviceCalls = 0;
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    reserveOutputs: async (resultPath, failurePath) => {
      assert.equal(resultPath, RESULT_PATH);
      assert.equal(failurePath, `${RESULT_PATH}.failed.json`);
      throw new Error("existing failure output");
    },
    buildExecutionServices: () => {
      serviceCalls += 1;
      return services();
    },
    execute: async () => {
      executeCalls += 1;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(serviceCalls, 0);
  assert.equal(executeCalls, 0);
});


test("passes the exact parsed prepared payload and independently loaded target to 04B once", async () => {
  const configured = configuration();
  let receivedInput: { prepared: PreparedPilotExecution; runtimeTarget: PilotRuntimeTarget } | undefined;
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    loadConfiguration: () => configured,
    execute: async (input) => {
      executeCalls += 1;
      receivedInput = input;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 0);
  assert.equal(executeCalls, 1);
  assert.deepEqual(receivedInput?.prepared, prepared());
  assert.equal(receivedInput?.runtimeTarget, configured.runtimeTarget);
});


test("publishes an exact versioned result envelope on normal success", async () => {
  const reservation = new FakeReservation();
  const original = result();
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => original,
  }));

  assert.equal(resultValue.exitCode, 0);
  assert.deepEqual(resultValue.result, original);
  assert.deepEqual(parsePilotExecutionResultArtifact(reservation.successContent!), original);
  assert.equal(reservation.failureContent, undefined);
  assert.equal(reservation.releaseCalls, 1);
});


test("cleanup failure after successful result publication cannot mask the result", async () => {
  const reservation = new FakeReservation();
  reservation.releaseFailure = new Error("cleanup failed");
  const original = result();
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => original,
  }));

  assert.equal(resultValue.exitCode, 0);
  assert.deepEqual(parsePilotExecutionResultArtifact(reservation.successContent!), original);
  assert.equal(reservation.releaseCalls, 1);
});


test("publishes safe normal failure evidence with completed outcomes and no retry", async () => {
  const reservation = new FakeReservation();
  const completed = result().outcomes;
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => {
      executeCalls += 1;
      throw staleError(completed);
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 1);
  const failure = parsePilotExecutionFailureArtifact(reservation.failureContent!);
  assert.equal(failure.executionCompleted, false);
  assert.deepEqual(failure.completedOutcomes, completed);
  assert.equal(failure.category, "STALE_PLAN");
  assert.equal(failure.completedResult, undefined);
  assert.equal(reservation.releaseCalls, 1);
});


test("stale execution remains nonzero and does not trigger automatic preflight or retry", async () => {
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(undefined, {
    execute: async () => {
      executeCalls += 1;
      throw staleError();
    },
  }));
  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 1);
});


test("preserves completed execution when success publication fails", async () => {
  const reservation = new FakeReservation();
  const original = result();
  reservation.successFailure = new Error(`publication failed with ${SECRET}`);
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => {
      executeCalls += 1;
      return original;
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 1);
  assert.deepEqual(resultValue.result, original);
  assert.equal(reservation.events.filter((event) => event === "publish-success").length, 1);
  assert.equal(reservation.events.filter((event) => event === "publish-failure").length, 1);
  const failure = parsePilotExecutionFailureArtifact(reservation.failureContent!);
  assert.equal(failure.executionCompleted, true);
  assert.deepEqual(failure.completedResult, original);
  assert.deepEqual(failure.completedOutcomes, original.outcomes);
  assert.equal(failure.category, "SUCCESS_ARTIFACT_PUBLICATION");
});


test("does not retry or compensate when both success and failure publication fail", async () => {
  const reservation = new FakeReservation();
  reservation.successFailure = new Error(`success publication ${SECRET}`);
  reservation.failureFailure = new Error(`failure publication ${PASSWORD}`);
  const lines: string[] = [];
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => {
      executeCalls += 1;
      return result();
    },
    writeLine: (line) => lines.push(line),
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 1);
  assert.equal(reservation.events.filter((event) => event === "publish-success").length, 1);
  assert.equal(reservation.events.filter((event) => event === "publish-failure").length, 1);
  assert.doesNotMatch(lines.join("\n"), new RegExp(`${SECRET}|${PASSWORD}`));
});


test("keeps normal failure nonzero when failure-evidence publication fails", async () => {
  const reservation = new FakeReservation();
  reservation.failureFailure = new Error(`failure evidence ${SECRET}`);
  const lines: string[] = [];
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => {
      executeCalls += 1;
      throw staleError();
    },
    writeLine: (line) => lines.push(line),
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 1);
  assert.equal(reservation.events.filter((event) => event === "publish-failure").length, 1);
  assert.equal(reservation.releaseCalls, 1);
  assert.doesNotMatch(lines.join("\n"), new RegExp(`${SECRET}|${PASSWORD}`));
});


test("releases unused reservation after service-construction failure without executing", async () => {
  const reservation = new FakeReservation();
  let executeCalls = 0;
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    buildExecutionServices: () => {
      throw new Error(`service construction failed ${SECRET}`);
    },
    execute: async () => {
      executeCalls += 1;
      return result();
    },
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.equal(executeCalls, 0);
  assert.equal(reservation.releaseCalls, 1);
});


test("keeps credentials and raw caught errors out of result, failure, and safe output", async () => {
  const reservation = new FakeReservation();
  const lines: string[] = [];
  const resultValue = await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => {
      throw new ControlledPilotExecutionError(
        "MEMBERSHIP",
        `provider ${SECRET} password ${PASSWORD}`,
        { runCorrelationId: RUN_ID, completedOutcomes: [] },
      );
    },
    writeLine: (line) => lines.push(line),
  }));

  assert.equal(resultValue.exitCode, 1);
  assert.doesNotMatch(reservation.failureContent!, new RegExp(`${SECRET}|${PASSWORD}|provider`));
  assert.doesNotMatch(lines.join("\n"), new RegExp(`${SECRET}|${PASSWORD}|provider`));
});


test("does not expose manifest loading, preflight, or planner seams in execute dependencies", async () => {
  const dependencyKeys = Object.keys(dependencies());
  assert.equal(dependencyKeys.includes("readManifest"), false);
  assert.equal(dependencyKeys.includes("preparePilotExecution"), false);
  assert.equal(dependencyKeys.includes("buildPilotPreflightPlan"), false);
});


test("failure evidence shape remains credential-free and transport-versioned", async () => {
  const reservation = new FakeReservation();
  await runExecuteCommand(commandArguments(), dependencies(reservation, {
    execute: async () => { throw staleError(); },
  }));

  const envelope = JSON.parse(reservation.failureContent!) as Record<string, unknown>;
  assert.equal(envelope.artifactType, "cadence.vs004.pilot-execution-failure");
  assert.equal(envelope.formatVersion, 1);
  assert.equal("error" in envelope, false);
  assert.equal("stack" in envelope, false);
  assert.equal(JSON.stringify(envelope).includes(SECRET), false);
  assert.equal(JSON.stringify(envelope).includes(PASSWORD), false);
});
