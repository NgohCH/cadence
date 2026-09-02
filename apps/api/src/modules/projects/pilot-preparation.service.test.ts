import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PilotProjectPreparationRepository,
  PilotProjectRecord,
} from "./pilot-preparation.repository";
import {
  ProjectsPilotPreparationError,
  ProjectsPilotPreparationService,
  type PilotProjectPreparationContext,
  type PilotProjectPreparationIntent,
} from "./pilot-preparation.service";


const operatorPersonId = "00441000-0000-4000-8000-000000000001";
const projectId = "00440000-0000-4000-8000-000000000001";
const ownerUserId = "00448000-0000-4000-8000-000000000001";
const runCorrelationId = "00449000-0000-4000-8000-000000000001";


function projectIntent(
  overrides: Partial<PilotProjectPreparationIntent["project"]> = {},
): PilotProjectPreparationIntent {
  return {
    manifestProjectKey: "pilot-project",
    project: {
      id: projectId,
      name: "Controlled Pilot",
      description: "M1 controlled pilot project",
      goal: "Exercise the governed pilot journey",
      lifecycleStatus: "active",
      progressPercent: 0,
      ownerUserId,
      startDate: "2026-09-01",
      targetDate: "2026-12-31",
      ...overrides,
    },
  };
}


function context(
  overrides: Partial<PilotProjectPreparationContext> = {},
): PilotProjectPreparationContext {
  return {
    operatorPersonId,
    runCorrelationId,
    ...overrides,
  };
}


function existingProject(
  overrides: Partial<PilotProjectRecord> = {},
): PilotProjectRecord {
  return {
    id: projectId,
    name: "Controlled Pilot",
    description: "M1 controlled pilot project",
    goal: "Exercise the governed pilot journey",
    lifecycleStatus: "active",
    progressPercent: 0,
    ownerUserId,
    startDate: "2026-09-01",
    targetDate: "2026-12-31",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}


class FakeProjectsPilotPreparationRepository
  implements PilotProjectPreparationRepository
{
  project: PilotProjectRecord | null = null;
  readonly writes: string[] = [];
  readFailure = false;
  createFailure = false;
  postcondition: PilotProjectRecord | null | undefined;

  async findProjectById(): Promise<PilotProjectRecord | null> {
    if (this.readFailure) {
      throw new Error("project read failure containing internal details");
    }
    return this.project;
  }

  async createProject(
    project: PilotProjectPreparationIntent["project"],
  ): Promise<PilotProjectRecord> {
    this.writes.push("createProject");
    if (this.createFailure) {
      throw new Error("project create failure");
    }
    this.project = this.postcondition === undefined
      ? { ...project, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }
      : this.postcondition;
    return this.project ?? { ...project, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" };
  }
}


function service(
  repository = new FakeProjectsPilotPreparationRepository(),
): ProjectsPilotPreparationService {
  return new ProjectsPilotPreparationService(repository);
}


test("creates a missing Project", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  const result = await service(repository).preparePilotProject(projectIntent(), context());

  assert.deepEqual(repository.writes, ["createProject"]);
  assert.deepEqual(result.resources, [
    { resource: "PROJECT", status: "CREATED", id: projectId },
  ]);
});


test("reuses exact Project with zero writes", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.project = existingProject();

  const result = await service(repository).preparePilotProject(projectIntent(), context());

  assert.deepEqual(repository.writes, []);
  assert.equal(result.resources[0].status, "REUSED");
});


test("planned Project REUSE fails stale when the Project is absent without creating", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context(), "REUSE"),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.code === "STALE_PLAN",
  );
  assert.deepEqual(repository.writes, []);
});


test("rejects incompatible Project attributes without writes", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.project = existingProject({ name: "Different project" });

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.category === "PROJECT" &&
      error.code === "ATTRIBUTE_CONFLICT",
  );
  assert.deepEqual(repository.writes, []);
});


test("rejects owner_user_id projection conflict without writes", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.project = existingProject({
    ownerUserId: "00448000-0000-4000-8000-000000000099",
  });

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.code === "OWNER_PROJECTION_CONFLICT",
  );
  assert.deepEqual(repository.writes, []);
});


test("rejects lifecycle and date conflicts without writes", async () => {
  for (const overrides of [
    { lifecycleStatus: "draft" as const },
    { targetDate: "2027-01-01" },
  ]) {
    const repository = new FakeProjectsPilotPreparationRepository();
    repository.project = existingProject(overrides);

    await assert.rejects(
      service(repository).preparePilotProject(projectIntent(), context()),
      (error: unknown) =>
        error instanceof ProjectsPilotPreparationError &&
        error.category === "PROJECT" &&
        error.code === "ATTRIBUTE_CONFLICT",
    );
    assert.deepEqual(repository.writes, []);
  }
});


test("read failure stops before mutation", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.readFailure = true;

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.category === "PERSISTENCE" &&
      error.code === "READ_FAILED",
  );
  assert.deepEqual(repository.writes, []);
});


test("create failure stops without compensation", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.createFailure = true;

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.category === "PERSISTENCE" &&
      error.code === "CREATE_FAILED",
  );
  assert.deepEqual(repository.writes, ["createProject"]);
});


test("Project postcondition mismatch fails without later operations", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  repository.postcondition = existingProject({ name: "raced project" });

  await assert.rejects(
    service(repository).preparePilotProject(projectIntent(), context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.category === "PROJECT" &&
      error.code === "POSTCONDITION_FAILED",
  );
  assert.deepEqual(repository.writes, ["createProject"]);
});


test("a successful rerun reuses Project without new writes", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  const pilot = projectIntent();

  await service(repository).preparePilotProject(pilot, context());
  const writesAfterFirstRun = [...repository.writes];
  const result = await service(repository).preparePilotProject(
    pilot,
    context({ runCorrelationId: "00449000-0000-4000-8000-000000000002" }),
  );

  assert.deepEqual(repository.writes, writesAfterFirstRun);
  assert.equal(result.resources[0].status, "REUSED");
});


test("Projects repository port has no Health or destructive methods", () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  const names = Object.getOwnPropertyNames(Object.getPrototypeOf(repository));

  assert.equal(names.some((name) =>
    /health|delete|truncate|update|upsert|history/i.test(name),
  ), false);
});


test("invalid nested intent fails before mutation", async () => {
  const repository = new FakeProjectsPilotPreparationRepository();
  const malformed = {
    ...projectIntent(),
    project: undefined,
  } as unknown as PilotProjectPreparationIntent;

  await assert.rejects(
    service(repository).preparePilotProject(malformed, context()),
    (error: unknown) =>
      error instanceof ProjectsPilotPreparationError &&
      error.category === "INPUT" &&
      error.code === "INVALID_INPUT",
  );
  assert.deepEqual(repository.writes, []);
});


test("Project evidence retains operator/correlation and no credentials", async () => {
  const result = await service().preparePilotProject(projectIntent(), context());

  assert.deepEqual(result.evidence, {
    manifestProjectKey: "pilot-project",
    projectId,
    operatorPersonId,
    runCorrelationId,
    lifecycleStatus: "active",
  });
  assert.equal("password" in result, false);
  assert.equal("secret" in result, false);
  assert.equal("token" in result, false);
});
