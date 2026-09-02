import {
  parsePreparedPilotExecutionArtifact,
  serializePilotExecutionFailureArtifact,
  serializePilotExecutionResultArtifact,
  type PilotExecutionFailureEvidence,
} from "./vs004-controlled-pilot-artifact";
import {
  ControlledPilotExecutionError,
  executeControlledPilot,
  type PilotExecutionResult,
} from "./vs004-controlled-pilot-execution";
import type {
  ExecutionOutputReservation,
} from "./vs004-controlled-pilot-file";
import type { ControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";
import type {
  ControlledPilotExecutionServices,
} from "./vs004-controlled-pilot-execution";
import type { PreparedPilotExecution } from "./vs004-controlled-pilot-preflight";


export interface ExecuteCommandArguments {
  readonly preparedPath: string;
  readonly resultPath: string;
}


export type ExecuteCommandParseResult =
  | { readonly kind: "RUN"; readonly arguments: ExecuteCommandArguments }
  | { readonly kind: "HELP" };


export interface ExecuteCommandDependencies {
  readonly readPrepared: (path: string) => Promise<string>;
  readonly loadConfiguration: () => ControlledPilotRuntimeConfiguration;
  readonly reserveOutputs: (
    resultPath: string,
    failurePath: string,
  ) => Promise<ExecutionOutputReservation>;
  readonly buildExecutionServices: (
    configuration: ControlledPilotRuntimeConfiguration,
  ) => ControlledPilotExecutionServices;
  readonly execute: typeof executeControlledPilot;
  readonly now: () => string;
  readonly writeLine: (line: string) => void;
}


export interface ExecuteCommandResult {
  readonly exitCode: 0 | 1;
  readonly result?: PilotExecutionResult;
}


export function parseExecuteArguments(
  argv: readonly string[],
): ExecuteCommandParseResult {
  if (argv.length === 1 && argv[0] === "--help") {
    return { kind: "HELP" };
  }

  let preparedPath: string | undefined;
  let resultPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option !== "--prepared" && option !== "--out") {
      throw new Error("Unsupported execute argument.");
    }

    const value = argv[index + 1];
    if (value === undefined || value === "--prepared" || value === "--out" || !value.trim()) {
      throw new Error(`Missing value for ${option}.`);
    }

    if (option === "--prepared") {
      if (preparedPath !== undefined) {
        throw new Error("Duplicate --prepared argument.");
      }
      preparedPath = value;
    } else {
      if (resultPath !== undefined) {
        throw new Error("Duplicate --out argument.");
      }
      resultPath = value;
    }
    index += 1;
  }

  if (preparedPath === undefined) {
    throw new Error("Missing --prepared argument.");
  }
  if (resultPath === undefined) {
    throw new Error("Missing --out argument.");
  }

  return {
    kind: "RUN",
    arguments: {
      preparedPath,
      resultPath,
    },
  };
}


export async function runExecuteCommand(
  args: ExecuteCommandArguments,
  dependencies: ExecuteCommandDependencies,
): Promise<ExecuteCommandResult> {
  let reservation: ExecutionOutputReservation | undefined;
  let prepared: PreparedPilotExecution | undefined;

  try {
    const serializedPrepared = await dependencies.readPrepared(args.preparedPath);
    prepared = parsePreparedPilotExecutionArtifact(serializedPrepared);
    const configuration = dependencies.loadConfiguration();
    reservation = await dependencies.reserveOutputs(
      args.resultPath,
      `${args.resultPath}.failed.json`,
    );

    let services: ControlledPilotExecutionServices;
    try {
      services = dependencies.buildExecutionServices(configuration);
    } catch {
      await releaseReservation(reservation);
      writeSafe(dependencies.writeLine, "EXECUTION NOT STARTED");
      return { exitCode: 1 };
    }

    let executionResult: PilotExecutionResult;
    try {
      executionResult = await dependencies.execute({
        prepared,
        runtimeTarget: configuration.runtimeTarget,
        services,
      });
    } catch (error) {
      const failurePublished = await publishExecutionFailure(
        reservation,
        createNormalFailureEvidence(error, prepared, dependencies.now),
      );
      await releaseReservation(reservation);
      writeFailureSummary(dependencies.writeLine, !failurePublished, error);
      return { exitCode: 1 };
    }

    try {
      const serializedResult = serializePilotExecutionResultArtifact(executionResult);
      await reservation.publishSuccess(serializedResult);
    } catch {
      const publicationFailure: PilotExecutionFailureEvidence = {
        manifestId: executionResult.manifestId,
        manifestHash: executionResult.manifestHash,
        runCorrelationId: executionResult.runCorrelationId,
        target: executionResult.target,
        category: "SUCCESS_ARTIFACT_PUBLICATION",
        completedOutcomes: executionResult.outcomes,
        executionCompleted: true,
        completedResult: executionResult,
        recordedAt: dependencies.now(),
      };
      const failurePublished = await publishExecutionFailure(reservation, publicationFailure);
      await releaseReservation(reservation);
      writeSafe(dependencies.writeLine, "EXECUTION COMPLETED");
      writeSafe(dependencies.writeLine, "SUCCESS ARTIFACT PUBLICATION FAILED");
      if (!failurePublished) {
        writeSafe(dependencies.writeLine, "FAILURE EVIDENCE NOT PERSISTED");
      }
      return { exitCode: 1, result: executionResult };
    }

    await releaseReservation(reservation);
    writeSuccessSummary(dependencies.writeLine, executionResult, args.resultPath);
    return { exitCode: 0, result: executionResult };
  } catch {
    if (reservation !== undefined) {
      await releaseReservation(reservation);
    }
    writeSafe(dependencies.writeLine, "EXECUTION FAILED");
    return { exitCode: 1 };
  }
}


function createNormalFailureEvidence(
  error: unknown,
  prepared: PreparedPilotExecution,
  now: () => string,
): PilotExecutionFailureEvidence {
  const executionError = error instanceof ControlledPilotExecutionError
    ? error
    : undefined;
  return {
    manifestId: executionError?.manifestId ?? prepared.manifestId,
    manifestHash: executionError?.manifestHash ?? prepared.manifestHash,
    runCorrelationId: prepared.runCorrelationId,
    target: prepared.target,
    category: executionError?.category ?? "PREPARED_EXECUTION",
    failedOperation: executionError?.failedOperation,
    completedOutcomes: executionError?.completedOutcomes ?? [],
    executionCompleted: false,
    recordedAt: now(),
  };
}


async function publishExecutionFailure(
  reservation: ExecutionOutputReservation,
  failure: PilotExecutionFailureEvidence,
): Promise<boolean> {
  try {
    const serializedFailure = serializePilotExecutionFailureArtifact(failure);
    await reservation.publishFailure(serializedFailure);
    return true;
  } catch {
    // Failure evidence is best effort and must not trigger retry or compensation.
    return false;
  }
}


async function releaseReservation(
  reservation: ExecutionOutputReservation,
): Promise<void> {
  try {
    await reservation.releaseUnused();
  } catch {
    // Cleanup cannot replace the known execution or publication outcome.
  }
}


function writeSuccessSummary(
  writeLine: (line: string) => void,
  result: PilotExecutionResult,
  resultPath: string,
): void {
  const created = result.outcomes.filter((outcome) => outcome.actualResult === "CREATED").length;
  const reused = result.outcomes.filter((outcome) => outcome.actualResult === "REUSED").length;
  writeSafe(writeLine, `MANIFEST ID: ${result.manifestId}`);
  writeSafe(writeLine, `RUN CORRELATION ID: ${result.runCorrelationId}`);
  writeSafe(writeLine, `CREATED: ${created}`);
  writeSafe(writeLine, `REUSED: ${reused}`);
  writeSafe(writeLine, `RESULT PATH: ${resultPath}`);
  writeSafe(writeLine, "EXECUTION COMPLETED");
}


function writeFailureSummary(
  writeLine: (line: string) => void,
  publicationFailed: boolean,
  error: unknown,
): void {
  writeSafe(writeLine, "EXECUTION FAILED");
  if (error instanceof ControlledPilotExecutionError && error.category === "STALE_PLAN") {
    writeSafe(writeLine, "NEW PREFLIGHT REQUIRED");
  }
  if (publicationFailed) {
    writeSafe(writeLine, "FAILURE EVIDENCE NOT PERSISTED");
  }
}


function writeSafe(writeLine: (line: string) => void, line: string): void {
  try {
    writeLine(line);
  } catch {
    // The injected diagnostic seam is not allowed to expose or replace execution state.
  }
}
