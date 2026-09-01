import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  computeManifestHash,
  validatePilotManifest,
  type PilotManifest,
} from "./vs004-pilot-manifest";


const ids = {
  project: "00440000-0000-4000-8000-000000000001",
  operator: "00441000-0000-4000-8000-000000000001",
  owner: "00441000-0000-4000-8000-000000000002",
  manager: "00441000-0000-4000-8000-000000000003",
  sponsor: "00441000-0000-4000-8000-000000000004",
  member: "00441000-0000-4000-8000-000000000005",
  observer: "00441000-0000-4000-8000-000000000006",
} as const;


function user(
  key: string,
  personId: string,
  cadenceUserId: string,
  role: string,
  sequence: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const membershipId =
    `00442000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  const initialRoleAssignmentId =
    `00443000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  const roleAssignmentId =
    role === "PROJECT_MEMBER"
      ? initialRoleAssignmentId
      : `00444000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  const authIdentityId =
    `00445000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

  return {
    key,
    displayName: `VS004 ${key}`,
    affiliation: "INTERNAL",
    person: {
      kind: "existing",
      id: personId,
    },
    cadenceUser: {
      id: cadenceUserId,
      username: `vs004_${key}`,
      displayName: `VS004 ${key}`,
      email: `vs004.${key}@cadence.test`,
      status: "active",
      identityProvider: "local",
    },
    authentication: {
      identityId: authIdentityId,
      provider: "local",
      loginIdentifier: `vs004.${key}@cadence.test`,
      providerSubjectId: `00446000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    },
    membership: {
      id: membershipId,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: null,
      grantedByPersonId: ids.operator,
      initialRoleAssignmentId,
    },
    role,
    roleAssignmentId,
    ...(role.startsWith("PROJECT_") &&
    [
      "PROJECT_OWNER",
      "PROJECT_MANAGER",
      "PROJECT_SPONSOR",
    ].includes(role)
      ? {
          protectedTransferId:
            `00447000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
          protectedRoleReason: `VS004 pilot ${role.toLowerCase()} appointment`,
        }
      : {}),
    ...overrides,
  };
}


function validManifest(): Record<string, unknown> {
  return {
    manifestVersion: "1.0",
    manifestId: "vs004-default-m1-pilot",
    target: {
      environment: "local",
      supabaseProjectRef: null,
      safeTargetMarker: "VS004_LOCAL_PILOT_TARGET",
      projectId: ids.project,
    },
    operator: {
      personId: ids.operator,
      displayName: "VS004 Pilot Operator",
    },
    project: {
      id: ids.project,
      marker: "VS004_LOCAL_PILOT_PROJECT",
      name: "VS004 Controlled Pilot Project",
      description: "Safe VS004 pilot example.",
      goal: "Exercise controlled project access.",
      lifecycleStatus: "active",
      ownerUserId: "00448000-0000-4000-8000-000000000002",
      startDate: "2026-09-01",
      targetDate: null,
      health: {
        status: "on_track",
        reasons: [],
        source: "system",
        changedBy: null,
      },
    },
    users: [
      user(
        "owner",
        ids.owner,
        "00448000-0000-4000-8000-000000000002",
        "PROJECT_OWNER",
        2,
      ),
      user(
        "manager",
        ids.manager,
        "00448000-0000-4000-8000-000000000003",
        "PROJECT_MANAGER",
        3,
      ),
      user(
        "sponsor",
        ids.sponsor,
        "00448000-0000-4000-8000-000000000004",
        "PROJECT_SPONSOR",
        4,
      ),
      user(
        "member",
        ids.member,
        "00448000-0000-4000-8000-000000000005",
        "PROJECT_MEMBER",
        5,
      ),
      user(
        "observer",
        ids.observer,
        "00448000-0000-4000-8000-000000000006",
        "PROJECT_OBSERVER",
        6,
      ),
    ],
  };
}


function cloneManifest(): Record<string, unknown> {
  return structuredClone(validManifest());
}


function reverseObjectPropertyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectPropertyOrder).reverse();
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .reverse()
    .map(([key, child]) => [key, reverseObjectPropertyOrder(child)] as const);
  return Object.fromEntries(entries);
}


function assertManifestRejects(
  mutate: (manifest: Record<string, unknown>) => void,
  message: RegExp,
): void {
  const manifest = cloneManifest();
  mutate(manifest);
  assert.throws(
    () => validatePilotManifest(manifest),
    message,
  );
}


test("validates the credential-free default M1 pilot manifest", () => {
  const validated =
    validatePilotManifest(validManifest());

  assert.equal(validated.users.length, 5);
  assert.equal(validated.project.id, ids.project);
  assert.equal(validated.target.environment, "local");
});


test("validates the checked-in example without credentials", () => {
  const example = JSON.parse(
    readFileSync(
      resolve(__dirname, "vs004-pilot.example.json"),
      "utf8",
    ),
  );

  const validated =
    validatePilotManifest(example);

  assert.equal(validated.users.length, 5);
  assert.doesNotMatch(
    JSON.stringify(example),
    /(password|secret|token|bearer|service.?role|credential)/i,
  );
});


test("rejects fewer than five pilot users", () => {
  assertManifestRejects(
    (manifest) => {
      (manifest.users as unknown[]).splice(4, 1);
    },
    /between 5 and 10 pilot users/,
  );
});


test("rejects more than ten pilot users", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as unknown[];
      users.push(
        user(
          "extra-1",
          "00441000-0000-4000-8000-000000000007",
          "00448000-0000-4000-8000-000000000007",
          "PROJECT_MEMBER",
          7,
        ),
        user(
          "extra-2",
          "00441000-0000-4000-8000-000000000008",
          "00448000-0000-4000-8000-000000000008",
          "PROJECT_MEMBER",
          8,
        ),
        user(
          "extra-3",
          "00441000-0000-4000-8000-000000000009",
          "00448000-0000-4000-8000-000000000009",
          "PROJECT_MEMBER",
          9,
        ),
        user(
          "extra-4",
          "00441000-0000-4000-8000-000000000010",
          "00448000-0000-4000-8000-000000000010",
          "PROJECT_MEMBER",
          10,
        ),
        user(
          "extra-5",
          "00441000-0000-4000-8000-000000000011",
          "00448000-0000-4000-8000-000000000011",
          "PROJECT_MEMBER",
          11,
        ),
        user(
          "extra-6",
          "00441000-0000-4000-8000-000000000012",
          "00448000-0000-4000-8000-000000000012",
          "PROJECT_MEMBER",
          12,
        ),
      );
    },
    /between 5 and 10 pilot users/,
  );
});


test("rejects a missing project", () => {
  assertManifestRejects(
    (manifest) => {
      delete manifest.project;
    },
    /project is required/,
  );
});


test("rejects more than one real pilot project", () => {
  assertManifestRejects(
    (manifest) => {
      manifest.projects = [
        manifest.project,
        { ...(manifest.project as Record<string, unknown>) },
      ];
      delete manifest.project;
    },
    /exactly one real pilot project/,
  );
});


for (const role of [
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_SPONSOR",
  "PROJECT_MEMBER",
]) {
  test(`rejects a manifest missing ${role}`, () => {
    assertManifestRejects(
      (manifest) => {
        const users = manifest.users as Record<string, unknown>[];
        const index = users.findIndex((candidate) => candidate.role === role);
        users.splice(index, 1);
        users.push(
          user(
            `replacement-${role.toLowerCase()}`,
            "00441000-0000-4000-8000-000000000007",
            "00448000-0000-4000-8000-000000000007",
            "PROJECT_OBSERVER",
            7,
          ),
        );
      },
      new RegExp(`${role} role is required`),
    );
  });
}


test("rejects duplicate manifest keys", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      users[1].key = users[0].key;
    },
    /duplicate manifest key/i,
  );
});


test("rejects duplicate intended login identifiers", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      (users[1].authentication as Record<string, unknown>).loginIdentifier =
        (users[0].authentication as Record<string, unknown>).loginIdentifier;
    },
    /duplicate intended login identifier/i,
  );
});


test("rejects duplicate Person IDs when default roles are not explicitly overlapped", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      (users[1].person as Record<string, unknown>).id =
        (users[0].person as Record<string, unknown>).id;
    },
    /distinct Persons|duplicate Person ID/,
  );
});


test("accepts an explicitly governed default-role overlap scenario", () => {
  const manifest = cloneManifest();
  const users = manifest.users as Record<string, unknown>[];
  (users[1].person as Record<string, unknown>).id =
    (users[0].person as Record<string, unknown>).id;
  manifest.governedRoleOverlapScenarios = [
    {
      id: "owner-manager-overlap",
      personId: ids.owner,
      roles: ["PROJECT_OWNER", "PROJECT_MANAGER"],
      reason: "Explicit leadership continuity rehearsal.",
    },
  ];

  assert.doesNotThrow(() => validatePilotManifest(manifest));
});


test("rejects duplicate Cadence User IDs", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      (users[1].cadenceUser as Record<string, unknown>).id =
        (users[0].cadenceUser as Record<string, unknown>).id;
    },
    /duplicate Cadence User ID/i,
  );
});


test("rejects malformed explicit UUID identifiers", () => {
  assertManifestRejects(
    (manifest) => {
      (manifest.project as Record<string, unknown>).id = "not-a-uuid";
    },
    /project.id must be a valid UUID/,
  );
});


test("rejects malformed timestamps and invalid membership periods", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      (users[0].membership as Record<string, unknown>).effectiveFrom =
        "2026-09-01";
    },
    /effectiveFrom must be an ISO-8601 timestamp with timezone/,
  );

  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      (users[0].membership as Record<string, unknown>).effectiveTo =
        "2026-08-31T00:00:00.000Z";
    },
    /effectiveTo must be after effectiveFrom/,
  );
});


test("rejects empty protected-role reasons", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      users[0].protectedRoleReason = "   ";
    },
    /protectedRoleReason must be a nonblank string/,
  );
});


test("rejects unsupported role names", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      users[4].role = "PROJECT_ADMIN";
    },
    /unsupported project role/,
  );
});


test("rejects external users in the default internal pilot", () => {
  assertManifestRejects(
    (manifest) => {
      const users = manifest.users as Record<string, unknown>[];
      users[4].affiliation = "EXTERNAL";
    },
    /default M1 pilot must contain INTERNAL users/,
  );
});


test("rejects credential-shaped manifest fields", () => {
  assertManifestRejects(
    (manifest) => {
      (manifest.users as Record<string, unknown>[])[0].password =
        "should-never-be-present";
    },
    /credential or secret field/i,
  );
});


test("rejects missing or unsafe target declarations", () => {
  assertManifestRejects(
    (manifest) => {
      delete manifest.target;
    },
    /target is required/,
  );

  assertManifestRejects(
    (manifest) => {
      (manifest.target as Record<string, unknown>).environment =
        "production";
    },
    /environment must be local, qa, or beta/,
  );

  assertManifestRejects(
    (manifest) => {
      (manifest.target as Record<string, unknown>).safeTargetMarker = " ";
    },
    /safeTargetMarker must be a nonblank string/,
  );
});


test("produces the same manifest hash for semantically identical validated manifests", () => {
  const first = validatePilotManifest(validManifest());
  const reordered = reverseObjectPropertyOrder(validManifest()) as Record<string, unknown>;

  const second = validatePilotManifest(reordered);

  assert.equal(
    computeManifestHash(first),
    computeManifestHash(second),
  );
});


test("does not include per-run correlation data in the manifest model or hash", () => {
  const manifest = validManifest();
  manifest.runCorrelationId = "00449000-0000-4000-8000-000000000001";

  assert.throws(
    () => validatePilotManifest(manifest),
    /unknown manifest field|runCorrelationId belongs to the execution input/i,
  );
});


test("returns an immutable validated manifest", () => {
  const validated =
    validatePilotManifest(validManifest()) as PilotManifest;

  assert.equal(Object.isFrozen(validated), true);
  const originalManifestId = validated.manifestId;
  (() => {
    (validated as unknown as { manifestId: string }).manifestId = "changed";
  })();
  assert.equal(validated.manifestId, originalManifestId);
});
