import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCurrentDeployment,
  type CloudflareCurrentDeploymentFacts,
} from "./vs005-cloudflare-current-deployment";
import {
  createCloudflareReadOnlyTransport,
  type CloudflareReadOnlyTransport,
  type CloudflareReadOnlyTransportResult,
  type CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";

const target: CloudflareWorkerInspectionTarget = {
  accountId: "account-test",
  workerName: "worker-test",
  publicHostname: "worker.example.test",
  configFingerprint: "fingerprint-test",
  generatedAccountId: "account-test",
  generatedWorkerName: "worker-test",
  profile: "FIRST_DEPLOYMENT_READINESS",
};

const deployment0 = {
  id: "deployment-current",
  versions: [
    { version_id: "version-current", percentage: 100 },
    { version_id: "version-canary", percentage: 0 },
  ],
  author: "author-canary",
  author_email: "email-canary@example.test",
  annotations: { note: "annotation-canary" },
  arbitrary: "metadata-canary",
};

const deployment1 = {
  id: "deployment-later-ignored",
  versions: [{ version_id: "version-later", percentage: 50 }],
};

type Envelope =
  | { success: true; result: unknown }
  | { success: false; errors: unknown[] };

function transportFor(
  envelope: Envelope,
  operation = "CURRENT_DEPLOYMENT",
): CloudflareReadOnlyTransport {
  return {
    read: async (): Promise<CloudflareReadOnlyTransportResult> => {
      if (envelope.success) return { kind: "SUCCESS", operation: operation as never, result: envelope.result };
      const errorCodes = envelope.errors.map((entry) => (
        typeof entry === "object" && entry !== null && "code" in entry && typeof entry.code === "number"
          ? entry.code
          : undefined
      )).filter((code): code is number => code !== undefined);
      return {
        kind: "PROVIDER_FAILURE",
        operation: operation as never,
        errorCodes,
        errorsWellFormed: envelope.errors.length > 0 && errorCodes.length === envelope.errors.length,
      };
    },
  };
}

function unavailableTransport(kind: "AUTHENTICATION_FAILED" | "AUTHORIZATION_FAILED" | "UNEXPECTED_PROVIDER_ERROR"): CloudflareReadOnlyTransport {
  return {
    read: async (): Promise<CloudflareReadOnlyTransportResult> => ({
      kind: "UNAVAILABLE",
      failure: { operation: "CURRENT_DEPLOYMENT", kind },
    }),
  };
}

function assertUnavailable(facts: CloudflareCurrentDeploymentFacts): void {
  assert.equal(facts.workerExists.state, "UNAVAILABLE");
  assert.equal(facts.currentDeployment.state, "UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(facts), /canary|author|email|annotation|metadata|message|exception/);
}

test("parses the first deployment as current and retains only bounded identity and traffic", async () => {
  const facts = await inspectCurrentDeployment(
    transportFor({ success: true, result: { deployments: [deployment0, deployment1] } }),
    target,
  );
  assert.deepEqual(facts, {
    workerExists: { state: "OBSERVED_VALUE", value: true },
    currentDeployment: {
      state: "OBSERVED_VALUE",
      value: {
        deploymentId: "deployment-current",
        versions: [
          { providerVersionId: "version-current", percentage: 100 },
          { providerVersionId: "version-canary", percentage: 0 },
        ],
      },
    },
  });
  assert.doesNotMatch(JSON.stringify(facts), /author-canary|email-canary|annotation-canary|metadata-canary|version-later/);
});

test("successful empty deployments prove Worker presence but no current deployment", async () => {
  const facts = await inspectCurrentDeployment(transportFor({ success: true, result: { deployments: [] } }), target);
  assert.deepEqual(facts, {
    workerExists: { state: "OBSERVED_VALUE", value: true },
    currentDeployment: { state: "OBSERVED_ABSENT" },
  });
});

test("nested deployment wrappers and malformed deployment results are unavailable", async () => {
  for (const result of [
    {},
    "not-an-array",
    [null],
    [{ id: "deployment", versions: [] }],
    [{ id: "deployment", versions: [{ version_id: "version", percentage: 101 }] }],
    [{ id: "deployment", versions: [{ version_id: "version", percentage: NaN }] }],
    [{ id: "deployment", versions: [{ version_id: "version", percentage: 50 }, { version_id: "version", percentage: 50 }] }],
  ]) {
    assertUnavailable(await inspectCurrentDeployment(transportFor({ success: true, result }), target));
  }
});

test("oversized deployment collections are unavailable", async () => {
  const deployments = Array.from({ length: 129 }, (_, index) => ({
    id: `deployment-${index}`,
    versions: [{ version_id: `version-${index}`, percentage: 100 }],
  }));
  assertUnavailable(await inspectCurrentDeployment(transportFor({ success: true, result: { deployments } }), target));
});

test("only an exact non-empty all-approved error set proves Worker absence", async () => {
  for (const errors of [[{ code: 10007 }], [{ code: 10090 }], [{ code: 10007 }, { code: 10090 }]]) {
    assert.deepEqual(
      await inspectCurrentDeployment(transportFor({ success: false, errors }), target),
      { workerExists: { state: "OBSERVED_ABSENT" }, currentDeployment: { state: "OBSERVED_ABSENT" } },
    );
  }
});

test("bounded 404 all-approved provider errors prove Worker absence end to end", async () => {
  for (const errorCodes of [[10007], [10090], [10007, 10090]]) {
    const transport = createCloudflareReadOnlyTransport({
      credentialProvider: { getCredential: async () => "token-canary" },
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        errors: errorCodes.map((code) => ({ code, message: "message-canary" })),
      }), { status: 404 }),
    });
    const facts = await inspectCurrentDeployment(transport, target);
    assert.deepEqual(facts, {
      workerExists: { state: "OBSERVED_ABSENT" },
      currentDeployment: { state: "OBSERVED_ABSENT" },
    });
    assert.doesNotMatch(JSON.stringify(facts), /token-canary|message-canary/);
  }
});

test("mixed, empty, malformed, and uncorrelated provider errors cannot prove absence", async () => {
  const cases: Array<[Envelope, string]> = [
    [{ success: false, errors: [{ code: 10007 }, { code: 99999, message: "message-canary" }] }, "mixed"],
    [{ success: false, errors: [] }, "empty"],
    [{ success: false, errors: [{ code: "10007", message: "message-canary" }] }, "malformed"],
  ];
  for (const [envelope, name] of cases) {
    assertUnavailable(await inspectCurrentDeployment(transportFor(envelope), target));
    assert.ok(name);
  }
  assertUnavailable(await inspectCurrentDeployment(transportFor({ success: false, errors: [{ code: 10007 }] }, "WORKER_SETTINGS"), target));
});

test("generic status, authentication, authorization, and transport failures remain unavailable", async () => {
  for (const kind of ["UNEXPECTED_PROVIDER_ERROR", "AUTHENTICATION_FAILED", "AUTHORIZATION_FAILED"] as const) {
    assertUnavailable(await inspectCurrentDeployment(unavailableTransport(kind), target));
  }
});

test("current deployment parsing never selects a rollback target", async () => {
  const facts = await inspectCurrentDeployment(
    transportFor({ success: true, result: { deployments: [deployment0, deployment1] } }),
    target,
  );
  assert.equal(facts.currentDeployment.state, "OBSERVED_VALUE");
  assert.equal("priorVersion" in facts, false);
  assert.equal("rollbackTarget" in facts, false);
});
