import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  createNodePilotArtifactFileSystem,
  PilotArtifactFileError,
  type ExecutionOutputReservation,
  type PilotArtifactFileSystem,
  publishJsonNoReplace,
  readJsonFile,
  reserveExecutionOutputs,
} from "./vs004-controlled-pilot-file";

class FakeFileSystem implements PilotArtifactFileSystem {
  readonly files = new Map<string, string>();
  readonly events: string[] = [];
  directoryWritable = true;
  hardLinksSupported = true;
  failCreate = false;
  failWrite = false;
  failSync = false;
  failLink: string | undefined;
  failCleanup = false;
  cleanupFailuresRemaining = 0;
  private nextTemp = 0;

  async readUtf8(path: string): Promise<string> {
    this.events.push(`read:${path}`);
    const value = this.files.get(path);
    if (value === undefined) {
      throw new Error("ENOENT");
    }
    return value;
  }

  async fileExists(path: string): Promise<boolean> {
    this.events.push(`exists:${path}`);
    return this.files.has(path);
  }

  async directoryIsWritable(path: string): Promise<boolean> {
    this.events.push(`writable:${path}`);
    return this.directoryWritable;
  }

  async probeHardLinkSupport(path: string): Promise<void> {
    this.events.push(`probe:${path}`);
    if (!this.hardLinksSupported) {
      throw new Error("ENOTSUP");
    }
  }

  async createExclusiveSibling(path: string): Promise<{
    readonly tempPath: string;
    readonly close: () => Promise<void>;
  }> {
    this.events.push(`create-exclusive:${path}`);
    if (this.failCreate) {
      throw new Error("EEXIST");
    }
    const tempPath = `${path}.pilot-${++this.nextTemp}`;
    this.files.set(tempPath, "");
    let closed = false;
    return {
      tempPath,
      close: async () => {
        if (!closed) {
          closed = true;
          this.events.push(`close:${tempPath}`);
        }
      },
    };
  }

  async writeAndFlush(tempPath: string, content: string): Promise<void> {
    this.events.push(`write:${tempPath}`);
    if (this.failWrite) {
      throw new Error("EIO");
    }
    this.files.set(tempPath, content);
    this.events.push(`sync:${tempPath}`);
    if (this.failSync) {
      throw new Error("EIO");
    }
    this.events.push(`close:${tempPath}`);
  }

  async publishNoReplace(tempPath: string, finalPath: string): Promise<void> {
    this.events.push(`link:${tempPath}->${finalPath}`);
    if (this.failLink !== undefined) {
      throw new Error(this.failLink);
    }
    if (this.files.has(finalPath)) {
      throw new Error("EEXIST");
    }
    const content = this.files.get(tempPath);
    if (content === undefined) {
      throw new Error("ENOENT");
    }
    this.files.set(finalPath, content);
  }

  async removeIfPresent(path: string): Promise<void> {
    this.events.push(`unlink:${path}`);
    if (this.cleanupFailuresRemaining > 0) {
      this.cleanupFailuresRemaining -= 1;
      throw new Error("EACCES");
    }
    if (this.failCleanup) {
      throw new Error("EACCES");
    }
    this.files.delete(path);
  }
}

function assertOrder(events: readonly string[], expected: string[]): void {
  let cursor = -1;
  for (const event of expected) {
    const next = events.findIndex((candidate, index) => index > cursor && candidate.startsWith(event));
    assert.notEqual(next, -1, `missing event ${event} in ${events.join(", ")}`);
    cursor = next;
  }
}

describe("VS004 pilot artifact file transport", () => {
  const temporaryDirectories: string[] = [];

  after(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("publishes one complete UTF-8 artifact without replacement", async () => {
    const fileSystem = new FakeFileSystem();
    await publishJsonNoReplace(fileSystem, "C:/pilot/prepared.json", "{\"message\":\"✓\"}");

    assert.equal(fileSystem.files.get("C:/pilot/prepared.json"), "{\"message\":\"✓\"}");
    assert.equal([...fileSystem.files.keys()].filter((path) => path.includes(".pilot-")).length, 0);
    assertOrder(fileSystem.events, ["create-exclusive", "write", "sync", "close", "link", "unlink"]);
  });

  it("rejects an existing final destination and preserves its bytes", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.files.set("C:/pilot/result.json", "original");

    await assert.rejects(
      publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "replacement"),
      /exists|EEXIST/i,
    );
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "original");
  });

  it("reserves both success and failure destinations before returning", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );

    assert.deepEqual(
      fileSystem.events.slice(0, 5),
      [
        "exists:C:/pilot/result.json",
        "exists:C:/pilot/result.json.failed.json",
        "writable:C:/pilot",
        "probe:C:/pilot",
        "create-exclusive:C:/pilot/result.json",
      ],
    );
    assert.equal(reservation.successPath, "C:/pilot/result.json");
    assert.equal(reservation.failurePath, "C:/pilot/result.json.failed.json");
    await reservation.releaseUnused();
    assert.equal(fileSystem.files.size, 0);
  });

  it("fails readiness for an unusable parent directory", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.directoryWritable = false;

    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
      /writable|directory/i,
    );
    assert.equal(fileSystem.events.includes("probe:C:/pilot"), false);
  });

  it("fails readiness when hard-link capability is unavailable", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.hardLinksSupported = false;

    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
      /hard.?link|ENOTSUP/i,
    );
    assert.equal(fileSystem.events.some((event) => event.startsWith("create-exclusive")), false);
  });

  it("fails closed when exclusive sibling creation collides", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failCreate = true;

    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
      /EEXIST|collision|exclusive/i,
    );
  });

  it("classifies reservation sibling creation failure as READINESS", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failCreate = true;

    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "READINESS",
    );
  });

  it("does not publish until complete content is written and flushed", async () => {
    const fileSystem = new FakeFileSystem();
    await publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "complete");

    assertOrder(fileSystem.events, ["write", "sync", "close", "link"]);
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "complete");
  });

  it("cleans the owned temporary sibling after successful publication", async () => {
    const fileSystem = new FakeFileSystem();
    await publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content");
    assert.deepEqual([...fileSystem.files.keys()], ["C:/pilot/result.json"]);
  });

  it("leaves no accepted final artifact after a write failure", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failWrite = true;

    await assert.rejects(publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content"));
    assert.equal(fileSystem.files.has("C:/pilot/result.json"), false);
    assert.equal([...fileSystem.files.keys()].some((path) => path.includes(".pilot-")), false);
  });

  it("leaves no accepted final artifact after a sync failure", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failSync = true;

    await assert.rejects(publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content"));
    assert.equal(fileSystem.files.has("C:/pilot/result.json"), false);
    assert.equal([...fileSystem.files.keys()].some((path) => path.includes(".pilot-")), false);
  });

  it("leaves no accepted partial final artifact after a link failure", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failLink = "EPERM";

    await assert.rejects(publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content"), /EPERM/);
    assert.equal(fileSystem.files.has("C:/pilot/result.json"), false);
    assert.equal([...fileSystem.files.keys()].some((path) => path.includes(".pilot-")), false);
  });

  it("preserves an externally created final file on publication-time EEXIST", async () => {
    const fileSystem = new FakeFileSystem();
    const originalPublish = fileSystem.publishNoReplace.bind(fileSystem);
    fileSystem.publishNoReplace = async (tempPath, finalPath) => {
      fileSystem.files.set(finalPath, "external");
      await originalPublish(tempPath, finalPath);
    };

    await assert.rejects(publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content"), /EEXIST/);
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "external");
  });

  it("treats hard-link success as publication success when temp cleanup fails", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;

    await reservation.publishSuccess("complete");

    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "complete");
    assert.equal([...fileSystem.files.keys()].some((path) => path.includes(".pilot-")), true);
  });

  it("allows releaseUnused to retry an owned temp cleanup after publication", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;
    await reservation.publishSuccess("complete");
    fileSystem.cleanupFailuresRemaining = 0;

    await reservation.releaseUnused();

    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "complete");
    assert.equal([...fileSystem.files.keys()].some((path) => path.includes(".pilot-")), false);
  });

  it("consumes success publication eligibility after cleanup failure", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;
    await reservation.publishSuccess("FIRST");
    const writesBeforeSecondAttempt = fileSystem.events.filter((event) => event.startsWith("write:")).length;

    await assert.rejects(
      reservation.publishSuccess("SECOND"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );

    assert.equal(fileSystem.events.filter((event) => event.startsWith("write:")).length, writesBeforeSecondAttempt);
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "FIRST");
  });

  it("consumes failure publication eligibility after cleanup failure", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;
    await reservation.publishFailure("FIRST");
    const writesBeforeSecondAttempt = fileSystem.events.filter((event) => event.startsWith("write:")).length;

    await assert.rejects(
      reservation.publishFailure("SECOND"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );

    assert.equal(fileSystem.events.filter((event) => event.startsWith("write:")).length, writesBeforeSecondAttempt);
    assert.equal(fileSystem.files.get("C:/pilot/result.json.failed.json"), "FIRST");
  });

  it("consumes publication eligibility after a primary failure", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.failWrite = true;
    await assert.rejects(
      reservation.publishSuccess("FIRST"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );
    fileSystem.failWrite = false;
    const writesBeforeSecondAttempt = fileSystem.events.filter((event) => event.startsWith("write:")).length;

    await assert.rejects(
      reservation.publishSuccess("SECOND"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );
    assert.equal(fileSystem.events.filter((event) => event.startsWith("write:")).length, writesBeforeSecondAttempt);

    await reservation.publishFailure("failure evidence");
    assert.equal(fileSystem.files.get("C:/pilot/result.json.failed.json"), "failure evidence");
  });

  it("retains only failed cleanup ownership across releaseUnused retries", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;

    await assert.rejects(reservation.releaseUnused());
    const remainingAfterFirstRelease = [...fileSystem.files.keys()];
    assert.equal(remainingAfterFirstRelease.length, 1);
    assert.equal(remainingAfterFirstRelease[0].includes(".pilot-"), true);

    await reservation.releaseUnused();
    assert.equal(fileSystem.files.size, 0);
  });

  it("does not restore publication after cleanup-only retry", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.cleanupFailuresRemaining = 1;
    await reservation.publishSuccess("FIRST");
    await reservation.releaseUnused();
    const writesBeforeSecondAttempt = fileSystem.events.filter((event) => event.startsWith("write:")).length;

    await assert.rejects(
      reservation.publishSuccess("SECOND"),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );
    assert.equal(fileSystem.events.filter((event) => event.startsWith("write:")).length, writesBeforeSecondAttempt);
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "FIRST");
  });

  it("keeps primary write, sync, and link failures categorized as PUBLICATION", async () => {
    const failures: FakeFileSystem[] = [];
    const writeFailure = new FakeFileSystem();
    writeFailure.failWrite = true;
    failures.push(writeFailure);
    const syncFailure = new FakeFileSystem();
    syncFailure.failSync = true;
    failures.push(syncFailure);
    const linkFailure = new FakeFileSystem();
    linkFailure.failLink = "EEXIST";
    failures.push(linkFailure);

    for (const fileSystem of failures) {
      await assert.rejects(
        publishJsonNoReplace(fileSystem, "C:/pilot/result.json", "content"),
        (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
      );
    }
  });

  it("keeps direct releaseUnused cleanup failure explicit as PUBLICATION", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    fileSystem.failCleanup = true;

    await assert.rejects(
      reservation.releaseUnused(),
      (error: unknown) => error instanceof PilotArtifactFileError && error.category === "PUBLICATION",
    );
    assert.equal(fileSystem.files.has("C:/pilot/result.json"), false);
    assert.equal(fileSystem.files.has("C:/pilot/result.json.failed.json"), false);
  });

  it("cleans unused reservations and makes cleanup idempotent", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    await reservation.releaseUnused();
    await reservation.releaseUnused();
    assert.equal(fileSystem.files.size, 0);
  });

  it("fails closed for permission and unsupported-link errors", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.hardLinksSupported = false;
    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
    );

    fileSystem.hardLinksSupported = true;
    fileSystem.failCreate = true;
    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
    );
  });

  it("exposes no generic final-file delete, overwrite, or rename capability", () => {
    const fileSystem = new FakeFileSystem();
    assert.equal("deleteFinal" in fileSystem, false);
    assert.equal("overwrite" in fileSystem, false);
    assert.equal("rename" in fileSystem, false);
  });

  it("reads UTF-8 JSON through the narrow file port", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.files.set("C:/pilot/prepared.json", "{\"ok\":true}");
    assert.equal(await readJsonFile(fileSystem, "C:/pilot/prepared.json"), "{\"ok\":true}");
  });

  it("rejects an existing failure destination during readiness", async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.files.set("C:/pilot/result.json.failed.json", "failure");
    await assert.rejects(
      reserveExecutionOutputs(fileSystem, "C:/pilot/result.json", "C:/pilot/result.json.failed.json"),
      /exists|EEXIST/i,
    );
    assert.equal(fileSystem.files.get("C:/pilot/result.json.failed.json"), "failure");
  });

  it("publishes success and failure reservation contents without replacement", async () => {
    const fileSystem = new FakeFileSystem();
    const reservation = await reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    );
    await reservation.publishSuccess("success");
    assert.equal(fileSystem.files.get("C:/pilot/result.json"), "success");
    await reservation.publishFailure("failure");
    assert.equal(fileSystem.files.get("C:/pilot/result.json.failed.json"), "failure");
  });

  it("requires the output reservation to complete before use", async () => {
    const fileSystem = new FakeFileSystem();
    let returned = false;
    const reservationPromise = reserveExecutionOutputs(
      fileSystem,
      "C:/pilot/result.json",
      "C:/pilot/result.json.failed.json",
    ).then((reservation) => {
      returned = true;
      return reservation;
    });
    assert.equal(returned, false);
    const reservation = await reservationPromise;
    assert.equal(returned, true);
    await reservation.releaseUnused();
  });

  it("verifies hard-link collision and cleanup on the actual Windows adapter", async (t) => {
    if (process.platform !== "win32") {
      t.skip("Windows-specific filesystem regression");
      return;
    }

    const directory = await mkdtemp(join(tmpdir(), "cadence-vs004-file-"));
    temporaryDirectories.push(directory);
    const fileSystem = createNodePilotArtifactFileSystem();
    const finalPath = join(directory, "artifact.json");
    const failurePath = `${finalPath}.failed.json`;

    await reserveExecutionOutputs(fileSystem, finalPath, failurePath).then((reservation) =>
      reservation.releaseUnused());
    await publishJsonNoReplace(fileSystem, finalPath, "complete ✓");
    assert.equal(await readFile(finalPath, "utf8"), "complete ✓");

    await assert.rejects(
      publishJsonNoReplace(fileSystem, finalPath, "replacement"),
      /EEXIST|exists/i,
    );
    assert.equal(await readFile(finalPath, "utf8"), "complete ✓");
    const remaining = await readdir(directory);
    assert.deepEqual(remaining, ["artifact.json"]);
  });

  it("keeps a real Windows final artifact immutable after failed temp cleanup", async (t) => {
    if (process.platform !== "win32") {
      t.skip("Windows-specific filesystem regression");
      return;
    }

    const directory = await mkdtemp(join(tmpdir(), "cadence-vs004-alias-"));
    temporaryDirectories.push(directory);
    const fileSystem = createNodePilotArtifactFileSystem();
    const finalPath = join(directory, "result.json");
    const failurePath = `${finalPath}.failed.json`;
    const originalRemove = fileSystem.removeIfPresent.bind(fileSystem);
    let failFirstTempCleanup = true;
    fileSystem.removeIfPresent = async (path) => {
      if (failFirstTempCleanup && path.endsWith(".tmp")) {
        failFirstTempCleanup = false;
        const error = new Error("EACCES") as Error & { readonly code: string };
        error.code = "EACCES";
        throw error;
      }
      return originalRemove(path);
    };

    const reservation = await reserveExecutionOutputs(fileSystem, finalPath, failurePath);
    await reservation.publishSuccess("FIRST");
    await assert.rejects(reservation.publishSuccess("SECOND"));
    assert.equal(await readFile(finalPath, "utf8"), "FIRST");

    await reservation.releaseUnused();
    assert.deepEqual(await readdir(directory), ["result.json"]);
  });
});
