import {
  validateCadenceEnvironmentSafety,
} from "./bootstrap/environment-safety";
import express from "express";
import cors from "cors";

import {
  createClient,
} from "@supabase/supabase-js";


import {
  success,
} from "./bootstrap/api-response";


import {
  SupabaseAuthProvider,
} from "./infrastructure/auth/supabase-auth-provider";


import {
  SupabaseAuditRepository,
} from "./infrastructure/database/supabase-audit.repository";

import {
  SupabaseIdentityRepository,
} from "./infrastructure/database/supabase-identity.repository";

import {
  SupabaseIdentityPersistenceRepository,
} from "./infrastructure/database/supabase-identity-persistence.repository";

import {
  SupabaseProjectMembershipRepository,
} from "./infrastructure/database/supabase-project-membership.repository";

import {
  SupabaseProjectMemberAdmissionRepository,
} from "./infrastructure/database/supabase-project-member-admission.repository";

import {
  SupabaseProjectRoleManagementRepository,
} from "./infrastructure/database/supabase-project-role-management.repository";

import {
  SupabaseProjectMembershipLifecycleRepository,
} from "./infrastructure/database/supabase-project-membership-lifecycle.repository";

import {
  SupabaseProjectLifecycleRepository,
} from "./infrastructure/database/supabase-project-lifecycle.repository";

import {
  SupabaseTasksMembershipResponsibilityRepository,
} from "./infrastructure/database/supabase-tasks-membership-responsibility.repository";

import {
  SupabaseProjectsRepository,
} from "./infrastructure/database/supabase-projects.repository";

import {
  SupabaseDiscussionRepository,
} from "./infrastructure/database/supabase-discussion.repository";

import {
  SupabaseTeamAgentRepository,
} from "./infrastructure/database/supabase-team-agent.repository";

import {
  SupabaseTeamAgentQueryRepository,
} from "./infrastructure/database/supabase-team-agent-query.repository";

import {
  SupabaseTasksRepository,
} from "./infrastructure/database/supabase-tasks.repository";

import {
  SupabaseTeamAgentMaterializationRepository,
} from "./infrastructure/database/supabase-team-agent-materialization.repository";


import {
  createAuthenticateMiddleware,
} from "./middleware/authenticate";

import {
  requestTraceMiddleware,
} from "./middleware/request-trace.middleware";


import {
  AuditQueryService,
} from "./modules/audit/audit-query.service";

import {
  createAuditRouter,
} from "./modules/audit/audit.routes";


import {
  IdentityService,
} from "./modules/identity/identity.service";

import {
  createIdentityRouter,
} from "./modules/identity/identity.routes";


import {
  ProjectAuthorisationService,
} from "./modules/project-membership/project-authorisation.service";

import {
  ProjectMembershipService,
} from "./modules/project-membership/project-membership.service";

import {
  createProjectMembershipRouter,
} from "./modules/project-membership/project-membership.routes";


import {
  ProjectsService,
} from "./modules/projects/projects.service";

import {
  DefaultProjectsMembershipLifecycleService,
} from "./modules/projects/projects-membership-lifecycle";

import {
  createProjectsRouter,
} from "./modules/projects/projects.routes";


import {
  DiscussionService,
} from "./modules/discussion/discussion.service";

import {
  createDiscussionRouter,
} from "./modules/discussion/discussion.routes";


import {
  TasksService,
} from "./modules/tasks/tasks.service";

import {
  DefaultTasksMembershipResponsibilityService,
} from "./modules/tasks/tasks-membership-responsibility";

import {
  createTasksRouter,
} from "./modules/tasks/tasks.routes";


import {
  TeamAgentService,
} from "./modules/team-agent/team-agent.service";

import {
  createTeamAgentRouter,
} from "./modules/team-agent/team-agent.routes";


import {
  TeamAgentQueryService,
} from "./modules/team-agent/team-agent-query.service";

import {
  createTeamAgentQueryRouter,
} from "./modules/team-agent/team-agent-query.routes";


import {
  TeamAgentTaskMaterializationService,
} from "./modules/team-agent/team-agent-task-materialization.service";

import {
  createTeamAgentTaskMaterializationRouter,
} from "./modules/team-agent/team-agent-task-materialization.routes";


const app =
  express();


const port =
  process.env.PORT
    ? Number(
        process.env.PORT
      )
    : 3000;


const webOrigin =
  process.env.WEB_ORIGIN ??
  "http://localhost:5173";


/*
 * Environment configuration
 */

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;


if (
  !supabaseUrl ||
  !supabasePublishableKey ||
  !supabaseSecretKey
) {
  throw new Error(
    "Missing required Supabase environment variables."
  );
}


/*
 * Infrastructure
 */

validateCadenceEnvironmentSafety({
  cadenceEnv:
    process.env.CADENCE_ENV,

  supabaseUrl,

  supabaseProjectRef:
    process.env.CADENCE_SUPABASE_PROJECT_REF,
});
const authProvider =
  new SupabaseAuthProvider(
    supabaseUrl,
    supabasePublishableKey
  );



const databaseClient =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    }
  );


const auditRepository =
  new SupabaseAuditRepository(
    databaseClient
  );


const identityRepository =
  new SupabaseIdentityRepository(
    databaseClient
  );

const identityPersistenceRepository =
  new SupabaseIdentityPersistenceRepository(
    databaseClient
  );


const projectMembershipRepository =
  new SupabaseProjectMembershipRepository(
    databaseClient
  );


const projectMemberAdmissionRepository =
  new SupabaseProjectMemberAdmissionRepository(
    databaseClient
  );

const projectRoleManagementRepository =
  new SupabaseProjectRoleManagementRepository(
    databaseClient
  );

const projectMembershipLifecycleRepository =
  new SupabaseProjectMembershipLifecycleRepository(
    databaseClient
  );

const projectLifecycleRepository =
  new SupabaseProjectLifecycleRepository(
    databaseClient
  );

const tasksMembershipResponsibilityRepository =
  new SupabaseTasksMembershipResponsibilityRepository(
    databaseClient
  );

const projectsRepository =
  new SupabaseProjectsRepository(
    databaseClient
  );


const discussionRepository =
  new SupabaseDiscussionRepository(
    databaseClient
  );


const teamAgentRepository =
  new SupabaseTeamAgentRepository(
    databaseClient
  );


const teamAgentQueryRepository =
  new SupabaseTeamAgentQueryRepository(
    databaseClient
  );


const tasksRepository =
  new SupabaseTasksRepository(
    databaseClient
  );


const teamAgentMaterializationRepository =
  new SupabaseTeamAgentMaterializationRepository(
    databaseClient
  );


/*
 * Application services
 */

const identityService =
  new IdentityService(
    identityRepository
  );


const projectAuthorisationService =
  new ProjectAuthorisationService(
    projectMembershipRepository
  );

const projectsMembershipLifecycleService =
  new DefaultProjectsMembershipLifecycleService(
    projectLifecycleRepository
  );

const tasksMembershipResponsibilityService =
  new DefaultTasksMembershipResponsibilityService(
    tasksMembershipResponsibilityRepository
  );


const projectMembershipService =
  new ProjectMembershipService(
    projectAuthorisationService,
    projectMembershipRepository,
    projectMemberAdmissionRepository,
    identityPersistenceRepository,
    projectRoleManagementRepository,
    {
      repository:
        projectMembershipLifecycleRepository,
      projects:
        projectsMembershipLifecycleService,
      tasks:
        tasksMembershipResponsibilityService,
    }
  );


const auditQueryService =
  new AuditQueryService(
    projectAuthorisationService,
    auditRepository
  );


const projectsService =
  new ProjectsService(
    projectAuthorisationService,
    projectsRepository
  );


const discussionService =
  new DiscussionService(
    projectAuthorisationService,
    discussionRepository
  );


const tasksService =
  new TasksService(
    projectAuthorisationService,
    tasksRepository
  );


const teamAgentService =
  new TeamAgentService(
    projectAuthorisationService,
    teamAgentRepository
  );


const teamAgentQueryService =
  new TeamAgentQueryService(
    projectAuthorisationService,
    teamAgentQueryRepository
  );


const teamAgentTaskMaterializationService =
  new TeamAgentTaskMaterializationService(
    projectAuthorisationService,
    teamAgentMaterializationRepository,
    tasksService
  );


const authenticate =
  createAuthenticateMiddleware(
    authProvider,
    identityService
  );


/*
 * Global middleware
 */

app.use(
  cors({
    origin:
      webOrigin,
  })
);


app.use(
  express.json()
);


app.use(
  requestTraceMiddleware
);


/*
 * Public routes
 */

app.get(
  "/health",
  (_req, res) => {
    res.status(
      200
    ).json(
      success(
        {
          status:
            "ok",
        },
        {
          correlation_id:
            res.locals
              .correlationId,

          request_id:
            res.locals
              .requestId,

          next_cursor:
            null,
        }
      )
    );
  }
);


/*
 * Protected routes
 */

app.use(
  "/api/v1",

  authenticate,

  createIdentityRouter(),

  createProjectsRouter(
    projectsService
  ),

  createProjectMembershipRouter(
    projectMembershipService
  ),

  createDiscussionRouter(
    discussionService
  ),

  createTasksRouter(
    tasksService
  ),

  createAuditRouter(
    auditQueryService
  ),

  createTeamAgentRouter(
    teamAgentService
  ),

  createTeamAgentQueryRouter(
    teamAgentQueryService
  ),

  createTeamAgentTaskMaterializationRouter(
    teamAgentTaskMaterializationService
  )
);


/*
 * Start server
 */

app.listen(
  port,
  () => {
    console.log(
      `Cadence API running on http://localhost:${port}`
    );
  }
);
