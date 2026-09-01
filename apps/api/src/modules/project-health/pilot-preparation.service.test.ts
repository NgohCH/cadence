import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PilotProjectHealthPreparationRepository,
  PilotProjectHealthRecord,
} from "./pilot-preparation.repository";
import {
  ProjectHealthPilotPreparationError,
  ProjectHealthPilotPreparationService,
  type PilotProjectHealthPreparationContext,
  type PilotProjectHealthPreparationIntent,
} from "./pilot-preparation.service";


const projectId = "00440000-0000-4000-8000-000000000001";
const operatorPersonId = "00441000-0000-4000-8000-000000000001";
const runCorrelationId = "00449000-0000-4000-8000-000000000001";


function healthIntent(
  overrides: Partial<PilotProjectHealthPreparationIntent> = {},
): PilotProjectHealthPreparationIntent {
  return {
    manifestProjectKey: "pilot-project",
    projectId,
    healthStatus: "on_track",
    reasons: [],
    source: "system",
    changedBy: null,
    ...overrides,
  };
}


function context(
  overrides: Partial<PilotProjectHealthPreparationContext> = {},
): PilotProjectHealthPreparationContext {
  return {
    operatorPersonId,
    runCorrelationId,
    ...overrides,
  };
}


function existingHealth(
  overrides: Partial<PilotProjectHealthRecord> = {},
): PilotProjectHealthRecord {
  return {
    projectId,
    healthStatus: "on_track",
    reasons: [],
    source: "system",
    changedBy: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}


class FakeProjectHealthPreparationRepository
  implements PilotProjectHealthPreparationRepository
{
  health: PilotProjectHealthRecord | null = null;
  readonly writes: string[] = [];
  readFailure = false;
  createFailure = false;
  postcondition: PilotProjectHealthRecord | null | undefined;

  async findCurrentProjectHealth(): Promise<PilotProjectHealthRecord | null> {
    if (this.readFailure) {
      throw new Error("health read failure containing internal details");
    }
    return this.health;
  }

  async createCurrentProjectHealth(
    health: Omit<PilotProjectHealthRecord, "updatedAt">,
  ): Promise<PilotProjectHealthRecord> {
    this.writes.push("createCurrentProjectHealth");
    if (this.createFailure) {
      throw new Error("health create failure");
    }
    this.health = this.postcondition === undefined
      ? { ...health, updatedAt: "2026-09-01T00:00:00.000Z" }
      : this.postcondition;
    return this.health ?? { ...health, updatedAt: "2026-09-01T00:00:00.000Z" };
  }
}


function service(
  repository = new FakeProjectHealthPreparationRepository(),
): ProjectHealthPilotPreparationService {
  return new ProjectHealthPilotPreparationService(repository);
}


test("creates missing exact current Project Health", async () => {
  const repository = new FakeProjectHealthPreparationRepository();

  const result = await service(repository).preparePilotHealth(
    healthIntent(),
    context(),
  );

  assert.deepEqual(repository.writes, ["createCurrentProjectHealth"]);
  assert.deepEqual(result.resources, [
    {
      resource: "PROJECT_HEALTH",
      status: "CREATED",
      id: projectId,
    },
  ]);
});


test("reuses exact current Project Health with zero writes", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  repository.health = existingHealth();

  const result = await service(repository).preparePilotHealth(
    healthIntent(),
    context(),
  );

  assert.deepEqual(repository.writes, []);
  assert.equal(result.resources[0].status, "REUSED");
});


test("rejects conflicting current Project Health without overwrite", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  repository.health = existingHealth({ healthStatus: "blocked" });

  await assert.rejects(
    service(repository).preparePilotHealth(healthIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectHealthPilotPreparationError &&
      error.category === "PROJECT_HEALTH" &&
      error.code === "CONFLICT",
  );
  assert.deepEqual(repository.writes, []);
});


test("verifies the exact current Project Health postcondition", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  repository.postcondition = existingHealth({ healthStatus: "at_risk" });

  await assert.rejects(
    service(repository).preparePilotHealth(healthIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectHealthPilotPreparationError &&
      error.code === "POSTCONDITION_FAILED",
  );
  assert.deepEqual(repository.writes, ["createCurrentProjectHealth"]);
});


test("read failure stops before Health creation", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  repository.readFailure = true;

  await assert.rejects(
    service(repository).preparePilotHealth(healthIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectHealthPilotPreparationError &&
      error.category === "PERSISTENCE" &&
      error.code === "READ_FAILED",
  );
  assert.deepEqual(repository.writes, []);
});


test("creation failure stops without compensation", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  repository.createFailure = true;

  await assert.rejects(
    service(repository).preparePilotHealth(healthIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectHealthPilotPreparationError &&
      error.category === "PERSISTENCE" &&
      error.code === "CREATE_FAILED",
  );
  assert.deepEqual(repository.writes, ["createCurrentProjectHealth"]);
});


test("safe resume creates only missing Health and cannot mutate Project", async () => {
  const repository = new FakeProjectHealthPreparationRepository();

  await service(repository).preparePilotHealth(healthIntent(), context());
  const writesAfterFirstRun = [...repository.writes];
  repository.health = null;
  await service(repository).preparePilotHealth(healthIntent(), context());

  assert.deepEqual(repository.writes, [
    ...writesAfterFirstRun,
    "createCurrentProjectHealth",
  ]);
  assert.equal(
    Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).some((name) =>
      /project|delete|truncate|update|upsert|history/i.test(name) &&
      !/findCurrentProjectHealth|createCurrentProjectHealth/.test(name),
    ),
    false,
  );
});


test("Health preparation retains operator/correlation evidence without secrets", async () => {
  const repository = new FakeProjectHealthPreparationRepository();
  const result = await service(repository).preparePilotHealth(healthIntent(), context(),);

  assert.deepEqual(result.evidence, {
    manifestProjectKey: "pilot-project",
    projectId,
    projectHealthId: projectId,
    operatorPersonId,
    runCorrelationId,
    healthStatus: "on_track",
  });
  assert.equal("password" in result, false);
  assert.equal("secret" in result, false);
  assert.equal("token" in result, false);
});
