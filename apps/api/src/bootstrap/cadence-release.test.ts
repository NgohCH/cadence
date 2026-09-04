import assert from "node:assert/strict";
import test from "node:test";
import { loadCadenceReleaseIdentity } from "./cadence-release";

test("normalizes safe release identity", () => {
  assert.deepEqual(
    loadCadenceReleaseIdentity({
      version: "1.0.0",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      buildId: "2026-09-04T10:00:00Z",
    }),
    {
      version: "1.0.0",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      buildId: "2026-09-04T10:00:00Z",
    },
  );
});

test("rejects an invalid commit SHA", () => {
  assert.throws(
    () => loadCadenceReleaseIdentity({
      version: "1.0.0",
      commitSha: "main",
      buildId: "2026-09-04T10:00:00Z",
    }),
    /commit SHA/,
  );
});
