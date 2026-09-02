import { randomUUID } from "node:crypto";
import {
  access,
  constants,
  link,
  open,
  readFile,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname, join, basename } from "node:path";


export interface PilotArtifactFileSystem {
  readUtf8(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  directoryIsWritable(path: string): Promise<boolean>;
  probeHardLinkSupport(path: string): Promise<void>;
  createExclusiveSibling(path: string): Promise<{
    readonly tempPath: string;
    readonly close: () => Promise<void>;
  }>;
  writeAndFlush(tempPath: string, content: string): Promise<void>;
  publishNoReplace(tempPath: string, finalPath: string): Promise<void>;
  removeIfPresent(path: string): Promise<void>;
}


export interface ExecutionOutputReservation {
  readonly successPath: string;
  readonly failurePath: string;
  publishSuccess(content: string): Promise<void>;
  publishFailure(content: string): Promise<void>;
  releaseUnused(): Promise<void>;
}


export type PilotFileErrorCategory = "READINESS" | "READ" | "PUBLICATION";


export class PilotArtifactFileError extends Error {
  readonly category: PilotFileErrorCategory;

  constructor(category: PilotFileErrorCategory, message: string) {
    super(message);
    this.name = "PilotArtifactFileError";
    this.category = category;
  }
}


export function createNodePilotArtifactFileSystem(): PilotArtifactFileSystem {
  return new NodePilotArtifactFileSystem();
}


export async function readJsonFile(
  fileSystem: PilotArtifactFileSystem,
  path: string,
): Promise<string> {
  try {
    return await fileSystem.readUtf8(path);
  } catch (error) {
    throw wrapFileError("READ", `Unable to read artifact file: ${path}.`, error);
  }
}


export async function publishJsonNoReplace(
  fileSystem: PilotArtifactFileSystem,
  finalPath: string,
  content: string,
): Promise<void> {
  const sibling = await createSibling(fileSystem, finalPath);
  try {
    await fileSystem.writeAndFlush(sibling.tempPath, content);
    await sibling.close();
    await fileSystem.publishNoReplace(sibling.tempPath, finalPath);
  } catch (error) {
    throw wrapFileError(
      "PUBLICATION",
      `Unable to publish artifact without replacement: ${finalPath}.`,
      error,
    );
  } finally {
    await cleanupOwnedSibling(fileSystem, sibling.tempPath);
  }
}


export async function reserveExecutionOutputs(
  fileSystem: PilotArtifactFileSystem,
  successPath: string,
  failurePath: string,
): Promise<ExecutionOutputReservation> {
  const successDirectory = validateOutputPaths(successPath, failurePath);
  const failureDirectory = dirname(failurePath);
  if (successDirectory !== failureDirectory) {
    throw new PilotArtifactFileError(
      "READINESS",
      "Success and failure artifact destinations must share a directory.",
    );
  }

  await assertAbsent(fileSystem, successPath);
  await assertAbsent(fileSystem, failurePath);
  await assertWritable(fileSystem, successDirectory);
  try {
    await fileSystem.probeHardLinkSupport(successDirectory);
  } catch (error) {
    throw wrapFileError(
      "READINESS",
      `Hard-link publication is unavailable in the output directory: ${successDirectory}.`,
      error,
    );
  }

  let successSibling: { readonly tempPath: string; readonly close: () => Promise<void> } | undefined;
  let failureSibling: { readonly tempPath: string; readonly close: () => Promise<void> } | undefined;
  try {
    successSibling = await createSibling(fileSystem, successPath, "READINESS");
    await successSibling.close();
    failureSibling = await createSibling(fileSystem, failurePath, "READINESS");
    await failureSibling.close();
  } catch (error) {
    if (successSibling !== undefined) {
      await cleanupOwnedSibling(fileSystem, successSibling.tempPath);
    }
    if (failureSibling !== undefined) {
      await cleanupOwnedSibling(fileSystem, failureSibling.tempPath);
    }
    throw wrapFileError("READINESS", "Unable to reserve execution outputs.", error);
  }

  return createReservation(
    fileSystem,
    successPath,
    failurePath,
    successSibling.tempPath,
    failureSibling.tempPath,
  );
}


function createReservation(
  fileSystem: PilotArtifactFileSystem,
  successPath: string,
  failurePath: string,
  successTempPath: string,
  failureTempPath: string,
): ExecutionOutputReservation {
  let successTemp: string | undefined = successTempPath;
  let failureTemp: string | undefined = failureTempPath;

  const publish = async (
    kind: "success" | "failure",
    content: string,
  ): Promise<void> => {
    const tempPath = kind === "success" ? successTemp : failureTemp;
    const finalPath = kind === "success" ? successPath : failurePath;
    if (tempPath === undefined) {
      throw new PilotArtifactFileError(
        "PUBLICATION",
        `${kind} artifact reservation is no longer available.`,
      );
    }

    try {
      await fileSystem.writeAndFlush(tempPath, content);
      await fileSystem.publishNoReplace(tempPath, finalPath);
    } catch (error) {
      await cleanupOwnedSibling(fileSystem, tempPath);
      throw wrapFileError(
        "PUBLICATION",
        `Unable to publish reserved ${kind} artifact without replacement: ${finalPath}.`,
        error,
      );
    }

    try {
      await fileSystem.removeIfPresent(tempPath);
      if (kind === "success") {
        successTemp = undefined;
      } else {
        failureTemp = undefined;
      }
    } catch {
      // The final hard link is already durable; releaseUnused may retry this owned cleanup.
    }
  };

  return {
    successPath,
    failurePath,
    publishSuccess: (content) => publish("success", content),
    publishFailure: (content) => publish("failure", content),
    releaseUnused: async () => {
      const errors: unknown[] = [];
      for (const tempPath of [successTemp, failureTemp]) {
        if (tempPath === undefined) {
          continue;
        }
        try {
          await fileSystem.removeIfPresent(tempPath);
        } catch (error) {
          errors.push(error);
        }
      }
      successTemp = undefined;
      failureTemp = undefined;
      if (errors.length > 0) {
        throw wrapFileError("PUBLICATION", "Unable to clean reserved temporary files.", errors[0]);
      }
    },
  };
}


function validateOutputPaths(successPath: string, failurePath: string): string {
  if (!successPath.trim() || !failurePath.trim()) {
    throw new PilotArtifactFileError("READINESS", "Artifact output paths must be nonblank.");
  }
  return dirname(successPath);
}


async function assertAbsent(
  fileSystem: PilotArtifactFileSystem,
  path: string,
): Promise<void> {
  let exists: boolean;
  try {
    exists = await fileSystem.fileExists(path);
  } catch (error) {
    throw wrapFileError("READINESS", `Unable to inspect artifact destination: ${path}.`, error);
  }
  if (exists) {
    throw new PilotArtifactFileError("READINESS", `Artifact destination already exists: ${path}.`);
  }
}


async function assertWritable(
  fileSystem: PilotArtifactFileSystem,
  directory: string,
): Promise<void> {
  let writable: boolean;
  try {
    writable = await fileSystem.directoryIsWritable(directory);
  } catch (error) {
    throw wrapFileError("READINESS", `Unable to inspect output directory: ${directory}.`, error);
  }
  if (!writable) {
    throw new PilotArtifactFileError("READINESS", `Output directory is not writable: ${directory}.`);
  }
}


async function createSibling(
  fileSystem: PilotArtifactFileSystem,
  finalPath: string,
  category: PilotFileErrorCategory = "PUBLICATION",
): Promise<{ readonly tempPath: string; readonly close: () => Promise<void> }> {
  try {
    return await fileSystem.createExclusiveSibling(finalPath);
  } catch (error) {
    throw wrapFileError(
      category,
      `Unable to create an exclusive temporary sibling for ${finalPath}.`,
      error,
    );
  }
}


async function cleanupOwnedSibling(
  fileSystem: PilotArtifactFileSystem,
  tempPath: string,
): Promise<void> {
  try {
    await fileSystem.removeIfPresent(tempPath);
  } catch {
    // Cleanup never targets a final destination and must not mask the primary failure.
  }
}


function wrapFileError(
  category: PilotFileErrorCategory,
  message: string,
  error: unknown,
): PilotArtifactFileError {
  if (error instanceof PilotArtifactFileError) {
    return error;
  }
  const code = errorCode(error);
  return new PilotArtifactFileError(category, code === undefined ? message : `${message} (${code}).`);
}


function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    const message = error instanceof Error ? error.message : String(error);
    return /^E[A-Z]+$/.test(message) ? message : undefined;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}


class NodePilotArtifactFileSystem implements PilotArtifactFileSystem {
  private readonly openHandles = new Map<string, FileHandle>();

  async readUtf8(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async directoryIsWritable(path: string): Promise<boolean> {
    try {
      await access(path, constants.W_OK);
      return true;
    } catch (error) {
      if (errorCode(error) === "ENOENT" || errorCode(error) === "EACCES" || errorCode(error) === "EPERM") {
        return false;
      }
      throw error;
    }
  }

  async probeHardLinkSupport(directory: string): Promise<void> {
    const sourcePath = join(directory, `.cadence-vs004-probe-${randomUUID()}.tmp`);
    const linkedPath = join(directory, `.cadence-vs004-probe-${randomUUID()}.link`);
    const collisionPath = join(directory, `.cadence-vs004-probe-${randomUUID()}.collision`);
    let sourceHandle: FileHandle | undefined;
    let collisionHandle: FileHandle | undefined;
    let probeError: unknown;

    try {
      sourceHandle = await open(sourcePath, "wx", 0o600);
      await sourceHandle.writeFile("cadence-vs004-hard-link-probe", "utf8");
      await sourceHandle.sync();
      await sourceHandle.close();
      sourceHandle = undefined;

      await link(sourcePath, linkedPath);
      const linkedContent = await readFile(linkedPath, "utf8");
      if (linkedContent !== "cadence-vs004-hard-link-probe") {
        throw new Error("Hard-link content verification failed.");
      }

      collisionHandle = await open(collisionPath, "wx", 0o600);
      await collisionHandle.close();
      collisionHandle = undefined;
      try {
        await link(sourcePath, collisionPath);
      } catch (error) {
        if (errorCode(error) !== "EEXIST") {
          throw error;
        }
      }
      if (await readFile(collisionPath, "utf8") !== "") {
        throw new Error("Hard-link collision changed the existing destination.");
      }
    } catch (error) {
      probeError = error;
    } finally {
      if (sourceHandle !== undefined) {
        await sourceHandle.close().catch(() => undefined);
      }
      if (collisionHandle !== undefined) {
        await collisionHandle.close().catch(() => undefined);
      }
      for (const path of [linkedPath, collisionPath, sourcePath]) {
        await unlink(path).catch((error) => {
          if (errorCode(error) !== "ENOENT" && probeError === undefined) {
            probeError = error;
          }
        });
      }
    }

    if (probeError !== undefined) {
      throw probeError;
    }
  }

  async createExclusiveSibling(finalPath: string): Promise<{
    readonly tempPath: string;
    readonly close: () => Promise<void>;
  }> {
    const tempPath = join(dirname(finalPath), `.${basename(finalPath)}.${randomUUID()}.tmp`);
    const handle = await open(tempPath, "wx", 0o600);
    this.openHandles.set(tempPath, handle);
    let closed = false;
    return {
      tempPath,
      close: async () => {
        if (closed) {
          return;
        }
        closed = true;
        const openHandle = this.openHandles.get(tempPath);
        if (openHandle !== undefined) {
          this.openHandles.delete(tempPath);
          await openHandle.close();
        }
      },
    };
  }

  async writeAndFlush(tempPath: string, content: string): Promise<void> {
    let handle = this.openHandles.get(tempPath);
    if (handle === undefined) {
      handle = await open(tempPath, "r+");
      this.openHandles.set(tempPath, handle);
    }
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      this.openHandles.delete(tempPath);
      await handle.close();
    }
  }

  async publishNoReplace(tempPath: string, finalPath: string): Promise<void> {
    await link(tempPath, finalPath);
  }

  async removeIfPresent(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error;
      }
    }
  }
}
