import { randomUUID } from "node:crypto";

import {
  parsePreflightArguments,
  runPreflightCommand,
  type PreflightCommandDependencies,
} from "./vs004-controlled-pilot-preflight-command";
import {
  preparePilotExecution,
  type ControlledPilotObservationSources,
} from "./vs004-controlled-pilot-preflight";
import {
  buildControlledPilotObservationRuntime,
} from "./vs004-controlled-pilot-runtime";
import {
  loadControlledPilotRuntimeConfiguration,
  type ControlledPilotRuntimeConfiguration,
} from "./vs004-controlled-pilot-runtime-config";
import {
  createNodePilotArtifactFileSystem,
  publishJsonNoReplace,
  readJsonFile,
  type PilotArtifactFileSystem,
} from "./vs004-controlled-pilot-file";


export interface PilotCliOutput {
  write(chunk: string): unknown;
}


export interface PilotCliProcess {
  readonly argv: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly stdout: PilotCliOutput;
  readonly stderr: PilotCliOutput;
  exitCode: number | string | null | undefined;
}


export interface PreflightCliDependencies {
  readonly parseArguments: typeof parsePreflightArguments;
  readonly runCommand: typeof runPreflightCommand;
  readonly loadConfiguration: (
    environment: NodeJS.ProcessEnv,
  ) => ControlledPilotRuntimeConfiguration;
  readonly buildObservationRuntime: (
    configuration: ControlledPilotRuntimeConfiguration,
  ) => ControlledPilotObservationSources;
  readonly createFileSystem: () => PilotArtifactFileSystem;
  readonly prepare: typeof preparePilotExecution;
  readonly createRunCorrelationId: () => string;
}


const PREFLIGHT_USAGE =
  "Usage: pilot:preflight --manifest <manifest.json> --out <prepared.json>\n";


export async function main(
  processLike: PilotCliProcess = process,
  overrides: Partial<PreflightCliDependencies> = {},
): Promise<void> {
  let parsed;
  try {
    parsed = (overrides.parseArguments ?? parsePreflightArguments)(
      processLike.argv.slice(2),
    );
  } catch {
    fail(processLike, "PREFLIGHT FAILED");
    return;
  }

  if (parsed.kind === "HELP") {
    write(processLike.stdout, PREFLIGHT_USAGE);
    processLike.exitCode = 0;
    return;
  }

  try {
    const fileSystem = (overrides.createFileSystem ?? createNodePilotArtifactFileSystem)();
    const loadConfiguration = overrides.loadConfiguration ?? loadControlledPilotRuntimeConfiguration;
    const configuration = loadConfiguration(processLike.env);
    const buildObservationRuntime = overrides.buildObservationRuntime ?? buildControlledPilotObservationRuntime;
    const observationSources = buildObservationRuntime(configuration);
    const runCommand = overrides.runCommand ?? runPreflightCommand;
    const dependencies: PreflightCommandDependencies = {
      readManifest: (path) => readJsonFile(fileSystem, path),
      loadConfiguration: () => configuration,
      observationSources,
      prepare: overrides.prepare ?? preparePilotExecution,
      publishPrepared: (path, content) => publishJsonNoReplace(fileSystem, path, content),
      createRunCorrelationId: overrides.createRunCorrelationId ?? randomUUID,
      writeLine: (line) => write(processLike.stdout, `${line}\n`),
    };
    const result = await runCommand(parsed.arguments, dependencies);
    processLike.exitCode = result.exitCode;
  } catch {
    fail(processLike, "PREFLIGHT FAILED");
  }
}


function fail(processLike: PilotCliProcess, message: string): void {
  processLike.exitCode = 1;
  write(processLike.stderr, `${message}\n`);
}


function write(output: PilotCliOutput, value: string): void {
  try {
    output.write(value);
  } catch {
    // Output failures cannot justify exposing a caught error.
  }
}


if (require.main === module) {
  void main();
}
