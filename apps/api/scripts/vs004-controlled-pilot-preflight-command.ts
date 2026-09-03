import {
  serializePreparedPilotExecutionArtifact,
} from "./vs004-controlled-pilot-artifact";
import {
  preparePilotExecution,
  type ControlledPilotObservationSources,
  type PreparedPilotExecution,
} from "./vs004-controlled-pilot-preflight";
import type { ControlledPilotRuntimeConfiguration } from "./vs004-controlled-pilot-runtime-config";


export interface PreflightCommandArguments {
  readonly manifestPath: string;
  readonly outputPath: string;
}


export type PreflightCommandParseResult =
  | { readonly kind: "RUN"; readonly arguments: PreflightCommandArguments }
  | { readonly kind: "HELP" };


export interface PreflightCommandDependencies {
  readonly readManifest: (path: string) => Promise<string>;
  readonly loadConfiguration: () => ControlledPilotRuntimeConfiguration;
  readonly observationSources: ControlledPilotObservationSources;
  readonly prepare: typeof preparePilotExecution;
  readonly publishPrepared: (path: string, content: string) => Promise<void>;
  readonly createRunCorrelationId: () => string;
  readonly writeLine: (line: string) => void;
}


export interface PreflightCommandResult {
  readonly exitCode: 0 | 1;
  readonly prepared?: PreparedPilotExecution;
}


export function parsePreflightArguments(
  argv: readonly string[],
): PreflightCommandParseResult {
  if (argv.length === 1 && argv[0] === "--help") {
    return { kind: "HELP" };
  }

  let manifestPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option !== "--manifest" && option !== "--out") {
      throw new Error("Unsupported preflight argument.");
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--") || !value.trim()) {
      throw new Error(`Missing value for ${option}.`);
    }

    if (option === "--manifest") {
      if (manifestPath !== undefined) {
        throw new Error("Duplicate --manifest argument.");
      }
      manifestPath = value;
    } else {
      if (outputPath !== undefined) {
        throw new Error("Duplicate --out argument.");
      }
      outputPath = value;
    }
    index += 1;
  }

  if (manifestPath === undefined) {
    throw new Error("Missing --manifest argument.");
  }
  if (outputPath === undefined) {
    throw new Error("Missing --out argument.");
  }

  return {
    kind: "RUN",
    arguments: {
      manifestPath,
      outputPath,
    },
  };
}


export async function runPreflightCommand(
  args: PreflightCommandArguments,
  dependencies: PreflightCommandDependencies,
): Promise<PreflightCommandResult> {
  try {
    const manifestText = await dependencies.readManifest(args.manifestPath);
    const manifest = JSON.parse(manifestText) as unknown;
    const configuration = dependencies.loadConfiguration();
    const runCorrelationId = dependencies.createRunCorrelationId();
    const prepared = await dependencies.prepare(
      {
        manifest,
        runtimeTarget: configuration.runtimeTarget,
        runCorrelationId,
      },
      dependencies.observationSources,
    );
    const serialized = serializePreparedPilotExecutionArtifact(prepared);
    await dependencies.publishPrepared(args.outputPath, serialized);
    writeSuccessSummary(dependencies.writeLine, prepared);
    return {
      exitCode: 0,
      prepared,
    };
  } catch {
    writeFailureSummary(dependencies.writeLine);
    return { exitCode: 1 };
  }
}


function writeSuccessSummary(
  writeLine: (line: string) => void,
  prepared: PreparedPilotExecution,
): void {
  writeLine(`MANIFEST ID: ${prepared.manifestId}`);
  writeLine(`ENVIRONMENT: ${prepared.target.environment}`);
  writeLine(`PROJECT ID: ${prepared.target.projectId}`);
  writeLine(`RUN CORRELATION ID: ${prepared.runCorrelationId}`);
  writeLine(
    `OBSERVED: users=${prepared.observedEvidence.userCount}, persons=${prepared.observedEvidence.personCount}, cadenceUsers=${prepared.observedEvidence.cadenceUserCount}, authenticationIdentities=${prepared.observedEvidence.authenticationIdentityCount}, authAccounts=${prepared.observedEvidence.authAccountCount}, projects=${prepared.observedEvidence.projectCount}, memberships=${prepared.observedEvidence.membershipCount}, roleAssignments=${prepared.observedEvidence.roleAssignmentCount}, protectedTransfers=${prepared.observedEvidence.protectedTransferCount}`,
  );
  writeLine("PREPARED — NOT EXECUTED");
  writeLine("NO MUTATIONS PERFORMED");
}


function writeFailureSummary(writeLine: (line: string) => void): void {
  try {
    writeLine("PREFLIGHT FAILED");
  } catch {
    // A diagnostic writer failure must not expose or replace the original safe result.
  }
}
