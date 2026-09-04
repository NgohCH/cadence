import assert from "node:assert/strict";
import { test } from "node:test";

import { createDeliveryRetryPolicy } from "./worker-retry-policy";

test("uses 60, 300, 900, then 3600 second delays", () => {
  const policy = createDeliveryRetryPolicy([60, 300, 900, 3600]);
  const failedAt = "2026-09-04T00:00:00.000Z";

  assert.equal(
    policy({ processingAttempts: 1, failedAt }),
    "2026-09-04T00:01:00.000Z",
  );
  assert.equal(
    policy({ processingAttempts: 2, failedAt }),
    "2026-09-04T00:05:00.000Z",
  );
  assert.equal(
    policy({ processingAttempts: 3, failedAt }),
    "2026-09-04T00:15:00.000Z",
  );
  assert.equal(
    policy({ processingAttempts: 4, failedAt }),
    "2026-09-04T01:00:00.000Z",
  );
  assert.equal(
    policy({ processingAttempts: 9, failedAt }),
    "2026-09-04T01:00:00.000Z",
  );
});
