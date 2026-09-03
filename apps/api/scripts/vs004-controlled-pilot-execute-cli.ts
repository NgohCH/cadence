import {
  parseExecuteArguments,
  runExecuteCommand,
} from "./vs004-controlled-pilot-execute-command";
import {
  buildControlledPilotExecutionServices,
} from "./vs004-controlled-pilot-runtime";
import {
  loadControlledPilotRuntimeConfiguration,
  type ControlledPilotRuntimeConfiguration,
} from "./vs004-controlled-pilot-runtime-config";
import {
  createNodePilotArtifactFileSystem,
  readJsonFile,
  reserveExecutionOutputs,
  type PilotArtifactFileSystem,
} from "./vs004-controlled-pilot-file";
import {
  executeControlledPilot,
} from "./vs004-controlled-pilot-execution";

import type { ExecuteCommandDependencies } from "./vs004-controlled-pilot-execute-command";


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


export interface ExecuteCliDependencies {
  readonly parseArguments: typeof parseExecuteArguments;
  readonly runCommand: typeof runExecuteCommand;
  readonly loadConfiguration: (
    environment: NodeJS.ProcessEnv,
  ) => ControlledPilotRuntimeConfiguration;
  readonly createFileSystem: () => PilotArtifactFileSystem;
  readonly buildExecutionServices: typeof buildControlledPilotExecutionServices;
}


const EXECUTE_USAGE =
  "Usage: pilot:execute --prepared <prepared.json> --out <result.json>\n";


export async function main(
  processLike: PilotCliProcess = process,
  overrides: Partial<ExecuteCliDependencies> = {},
): Promise<void> {
  let parsed;
  try {
    parsed = (overrides.parseArguments ?? parseExecuteArguments)(
      processLike.argv.slice(2),
    );
  } catch {
    fail(processLike, "EXECUTE FAILED");
    return;
  }

  if (parsed.kind === "HELP") {
    write(processLike.stdout, EXECUTE_USAGE);
    processLike.exitCode = 0;
    return;
  }

  try {
    const fileSystem = (overrides.createFileSystem ?? createNodePilotArtifactFileSystem)();
    const loadConfiguration = overrides.loadConfiguration ?? loadControlledPilotRuntimeConfiguration;
    const runCommand = overrides.runCommand ?? runExecuteCommand;
    const dependencies: ExecuteCommandDependencies = {
      readPrepared: (path) => readJsonFile(fileSystem, path),
      loadConfiguration: () => loadConfiguration(processLike.env),
      reserveOutputs: (resultPath, failurePath) =>
        reserveExecutionOutputs(fileSystem, resultPath, failurePath),
      buildExecutionServices: (configuration) =>
        (overrides.buildExecutionServices ?? buildControlledPilotExecutionServices)(configuration),
      execute: executeControlledPilot,
      now: () => new Date().toISOString(),
      writeLine: (line) => write(processLike.stdout, `${line}\n`),
    };
    const result = await runCommand(parsed.arguments, dependencies);
    processLike.exitCode = result.exitCode;
  } catch {
    fail(processLike, "EXECUTE FAILED");
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
