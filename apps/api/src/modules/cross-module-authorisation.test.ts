import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  DiscussionService,
} from "./discussion/discussion.service";
import { DiscussionPermissionDeniedError } from "./discussion/discussion.errors";
import type { EffectiveProjectAuthorisation } from "./project-membership/project-authorisation.types";

const root = resolve(process.cwd(), "src");

const consumingServices = [
  "discussion/discussion.service.ts",
  "tasks/tasks.service.ts",
  "audit/audit-query.service.ts",
  "projects/projects.service.ts",
  "team-agent/team-agent.service.ts",
  "team-agent/team-agent-query.service.ts",
  "team-agent/team-agent-task-materialization.service.ts",
];

const forbiddenAuthorizationTokens = [
  /\bRbacService\b/,
  /\bhas_project_permission\s*\(/,
  /\bis_project_member\s*\(/,
  /\bcurrent_app_user_id\s*\(/,
  /\bhas_platform_permission\s*\(/,
  /\bcan_access_(?:message|file|decision)\s*\(/,
  /\.from\(["']project_(?:memberships|role_assignments|role_transfers)["']\)/,
];

test("consuming project services use the canonical authorization boundary", () => {
  for (const relativePath of consumingServices) {
    const source = readFileSync(resolve(root, "modules", relativePath), "utf8");
    assert.match(
      source,
      /getEffectiveProjectAuthorisation\s*\(/,
      `${relativePath} must resolve canonical project authorization`,
    );
    for (const token of forbiddenAuthorizationTokens) {
      assert.doesNotMatch(
        source,
        token,
        `${relativePath} contains a local authorization/persistence dependency`,
      );
    }
  }
});

test("browser business features remain API-bound and do not use Supabase tables", () => {
  const featuresRoot = resolve(process.cwd(), "..", "web", "src", "features");
  const featureFiles = [
    "discussion/DiscussionPanel.tsx",
    "tasks/MyTasksPanel.tsx",
    "audit/TaskAuditPanel.tsx",
    "team-agent/ProposalReviewPanel.tsx",
    "workspace/WorkspaceShell.tsx",
    "members/MembersPanel.tsx",
  ];

  for (const relativePath of featureFiles) {
    const source = readFileSync(resolve(featuresRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /supabase/i, `${relativePath} must not access Supabase directly`);
    if (source.includes("apiFetch")) {
      assert.doesNotMatch(source, /\.from\s*\(/, `${relativePath} must not query business tables`);
    }
  }
});

test("persistence RPCs remain service-role defense in depth, not a second policy authority", () => {
  const auditMigration = readFileSync(
    resolve(process.cwd(), "..", "..", "supabase", "migrations", "20260828141500_r02e_audit_authorisation_cutover.sql"),
    "utf8",
  );
  assert.match(
    auditMigration,
    /create or replace function public\.get_task_audit_journey\(\s*p_project_id uuid,\s*p_task_id uuid\s*\)/i,
  );
  assert.doesNotMatch(auditMigration, /has_project_permission\s*\(/i);
  assert.match(auditMigration, /receives no caller identity/i);

  const browserBoundaryMigration = readFileSync(
    resolve(process.cwd(), "..", "..", "supabase", "migrations", "20260828144000_r02e_browser_database_boundary.sql"),
    "utf8",
  );
  assert.match(browserBoundaryMigration, /revoke usage\s+on schema public\s+from public, anon, authenticated/i);
  assert.match(browserBoundaryMigration, /drop function if exists\s+public\.has_project_permission/i);
});

test("an authoritative mutation re-checks authorization after an earlier allowed request", async () => {
  let allowed = true;
  let writes = 0;
  const authorisation = {
    async getEffectiveProjectAuthorisation(): Promise<EffectiveProjectAuthorisation> {
      return {
        personId: "person-1",
        projectId: "project-1",
        evaluatedAt: "2026-08-29T00:00:00.000Z",
        roles: ["PROJECT_MEMBER"],
        permissions: allowed ? ["project.view", "message.create"] : ["project.view"],
        membershipIds: ["membership-1"],
      };
    },
  };
  const repository = {
    async createMessage(input: { projectId: string; content: string }) {
      writes += 1;
      return {
        id: "message-1",
        projectId: input.projectId,
        authorUserId: "user-1",
        authorType: "human" as const,
        threadParentId: null,
        currentVersion: 1,
        content: input.content,
        createdAt: "2026-08-29T00:00:00.000Z",
        editedAt: null,
      };
    },
    async listProjectMessages() {
      return [];
    },
    async getMessageVersion() {
      return null;
    },
  };
  const service = new DiscussionService(authorisation, repository);
  const context = {
    actorUserId: "user-1",
    actorPersonId: "person-1",
    correlationId: "correlation-1",
    requestId: "request-1",
    source: "web" as const,
    identityProvider: "test",
  };

  await service.postMessage(context, "project-1", "first message");
  allowed = false;

  await assert.rejects(
    service.postMessage(context, "project-1", "second message"),
    DiscussionPermissionDeniedError,
  );
  assert.equal(writes, 1);
});
