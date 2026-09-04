import cors from "cors";
import express, { type Express } from "express";
import { createClient } from "@supabase/supabase-js";

import {
  fingerprintCadenceRuntimeConfig,
  type CadenceResolvedSecrets,
  type CadenceRuntimeConfig,
} from "../bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../bootstrap/cadence-release";
import { SupabaseAuthProvider } from "../infrastructure/auth/supabase-auth-provider";
import { SupabaseAuditRepository } from "../infrastructure/database/supabase-audit.repository";
import { SupabaseIdentityRepository } from "../infrastructure/database/supabase-identity.repository";
import { SupabaseIdentityPersistenceRepository } from "../infrastructure/database/supabase-identity-persistence.repository";
import { SupabaseProjectMembershipRepository } from "../infrastructure/database/supabase-project-membership.repository";
import { SupabaseProjectMemberAdmissionRepository } from "../infrastructure/database/supabase-project-member-admission.repository";
import { SupabaseProjectRoleManagementRepository } from "../infrastructure/database/supabase-project-role-management.repository";
import { SupabaseProjectMembershipLifecycleRepository } from "../infrastructure/database/supabase-project-membership-lifecycle.repository";
import { SupabaseProjectLifecycleRepository } from "../infrastructure/database/supabase-project-lifecycle.repository";
import { SupabaseTasksMembershipResponsibilityRepository } from "../infrastructure/database/supabase-tasks-membership-responsibility.repository";
import { SupabaseProjectsRepository } from "../infrastructure/database/supabase-projects.repository";
import { SupabaseDiscussionRepository } from "../infrastructure/database/supabase-discussion.repository";
import { SupabaseTeamAgentRepository } from "../infrastructure/database/supabase-team-agent.repository";
import { SupabaseTeamAgentQueryRepository } from "../infrastructure/database/supabase-team-agent-query.repository";
import { SupabaseTasksRepository } from "../infrastructure/database/supabase-tasks.repository";
import { SupabaseTeamAgentMaterializationRepository } from "../infrastructure/database/supabase-team-agent-materialization.repository";
import { createAuthenticateMiddleware } from "../middleware/authenticate";
import { requestTraceMiddleware } from "../middleware/request-trace.middleware";
import { AuditQueryService } from "../modules/audit/audit-query.service";
import { createAuditRouter } from "../modules/audit/audit.routes";
import { IdentityService } from "../modules/identity/identity.service";
import { createIdentityRouter } from "../modules/identity/identity.routes";
import { ProjectAuthorisationService } from "../modules/project-membership/project-authorisation.service";
import { ProjectMembershipService } from "../modules/project-membership/project-membership.service";
import { createProjectMembershipRouter } from "../modules/project-membership/project-membership.routes";
import { ProjectsService } from "../modules/projects/projects.service";
import { DefaultProjectsMembershipLifecycleService } from "../modules/projects/projects-membership-lifecycle";
import { createProjectsRouter } from "../modules/projects/projects.routes";
import { DiscussionService } from "../modules/discussion/discussion.service";
import { createDiscussionRouter } from "../modules/discussion/discussion.routes";
import { TasksService } from "../modules/tasks/tasks.service";
import { DefaultTasksMembershipResponsibilityService } from "../modules/tasks/tasks-membership-responsibility";
import { createTasksRouter } from "../modules/tasks/tasks.routes";
import { TeamAgentService } from "../modules/team-agent/team-agent.service";
import { createTeamAgentRouter } from "../modules/team-agent/team-agent.routes";
import { TeamAgentQueryService } from "../modules/team-agent/team-agent-query.service";
import { createTeamAgentQueryRouter } from "../modules/team-agent/team-agent-query.routes";
import { TeamAgentTaskMaterializationService } from "../modules/team-agent/team-agent-task-materialization.service";
import { createTeamAgentTaskMaterializationRouter } from "../modules/team-agent/team-agent-task-materialization.routes";

export interface CadenceAppRuntime {
  config: CadenceRuntimeConfig;
  secrets: CadenceResolvedSecrets;
  release: CadenceReleaseIdentity;
}

export function createCadenceApp(runtime: CadenceAppRuntime): Express {
  const app = express();
  const databaseClient = createClient(
    runtime.config.supabase.url,
    runtime.secrets.supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  const authProvider = new SupabaseAuthProvider(
    runtime.config.supabase.url,
    runtime.config.supabase.publishableKey,
  );

  const auditRepository = new SupabaseAuditRepository(databaseClient);
  const identityRepository = new SupabaseIdentityRepository(databaseClient);
  const identityPersistenceRepository = new SupabaseIdentityPersistenceRepository(databaseClient);
  const projectMembershipRepository = new SupabaseProjectMembershipRepository(databaseClient);
  const projectMemberAdmissionRepository = new SupabaseProjectMemberAdmissionRepository(databaseClient);
  const projectRoleManagementRepository = new SupabaseProjectRoleManagementRepository(databaseClient);
  const projectMembershipLifecycleRepository = new SupabaseProjectMembershipLifecycleRepository(databaseClient);
  const projectLifecycleRepository = new SupabaseProjectLifecycleRepository(databaseClient);
  const tasksMembershipResponsibilityRepository = new SupabaseTasksMembershipResponsibilityRepository(databaseClient);
  const projectsRepository = new SupabaseProjectsRepository(databaseClient);
  const discussionRepository = new SupabaseDiscussionRepository(databaseClient);
  const teamAgentRepository = new SupabaseTeamAgentRepository(databaseClient);
  const teamAgentQueryRepository = new SupabaseTeamAgentQueryRepository(databaseClient);
  const tasksRepository = new SupabaseTasksRepository(databaseClient);
  const teamAgentMaterializationRepository = new SupabaseTeamAgentMaterializationRepository(databaseClient);

  const identityService = new IdentityService(identityRepository);
  const projectAuthorisationService = new ProjectAuthorisationService(projectMembershipRepository);
  const projectsMembershipLifecycleService = new DefaultProjectsMembershipLifecycleService(projectLifecycleRepository);
  const tasksMembershipResponsibilityService = new DefaultTasksMembershipResponsibilityService(tasksMembershipResponsibilityRepository);
  const projectMembershipService = new ProjectMembershipService(
    projectAuthorisationService,
    projectMembershipRepository,
    projectMemberAdmissionRepository,
    identityPersistenceRepository,
    projectRoleManagementRepository,
    {
      repository: projectMembershipLifecycleRepository,
      projects: projectsMembershipLifecycleService,
      tasks: tasksMembershipResponsibilityService,
    },
  );
  const auditQueryService = new AuditQueryService(projectAuthorisationService, auditRepository);
  const projectsService = new ProjectsService(projectAuthorisationService, projectsRepository);
  const discussionService = new DiscussionService(projectAuthorisationService, discussionRepository);
  const tasksService = new TasksService(projectAuthorisationService, tasksRepository);
  const teamAgentService = new TeamAgentService(projectAuthorisationService, teamAgentRepository);
  const teamAgentQueryService = new TeamAgentQueryService(projectAuthorisationService, teamAgentQueryRepository);
  const teamAgentTaskMaterializationService = new TeamAgentTaskMaterializationService(
    projectAuthorisationService,
    teamAgentMaterializationRepository,
    tasksService,
  );
  const authenticate = createAuthenticateMiddleware(authProvider, identityService);
  const allowedOrigin = new URL(runtime.config.application.publicUrl).origin;

  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json({ limit: runtime.config.application.requestBodyLimitBytes }));
  app.use(requestTraceMiddleware);
  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "cadence-api",
      environment: runtime.config.application.environment,
      configVersion: runtime.config.configVersion,
      configFingerprint: fingerprintCadenceRuntimeConfig(runtime.config),
      ...runtime.release,
    });
  });
  app.use(
    "/api/v1",
    authenticate,
    createIdentityRouter(),
    createProjectsRouter(projectsService),
    createProjectMembershipRouter(projectMembershipService),
    createDiscussionRouter(discussionService),
    createTasksRouter(tasksService),
    createAuditRouter(auditQueryService),
    createTeamAgentRouter(teamAgentService),
    createTeamAgentQueryRouter(teamAgentQueryService),
    createTeamAgentTaskMaterializationRouter(teamAgentTaskMaterializationService),
  );

  return app;
}
