import express from "express";
import { createClient } from "@supabase/supabase-js";

import { success } from "./bootstrap/api-response";

import { SupabaseAuthProvider } from "./infrastructure/auth/supabase-auth-provider";

import { SupabaseAuditRepository } from "./infrastructure/database/supabase-audit.repository";
import { SupabaseIdentityRepository } from "./infrastructure/database/supabase-identity.repository";
import { SupabaseRbacRepository } from "./infrastructure/database/supabase-rbac.repository";
import { SupabaseProjectsRepository } from "./infrastructure/database/supabase-projects.repository";
import { SupabaseDiscussionRepository } from "./infrastructure/database/supabase-discussion.repository";
import { SupabaseTeamAgentRepository } from "./infrastructure/database/supabase-team-agent.repository";
import { SupabaseTasksRepository } from "./infrastructure/database/supabase-tasks.repository";
import { SupabaseTeamAgentMaterializationRepository } from "./infrastructure/database/supabase-team-agent-materialization.repository";

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
  RbacService,
} from "./modules/rbac/rbac.service";

import {
  ProjectsService,
} from "./modules/projects/projects.service";

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
  createTasksRouter,
} from "./modules/tasks/tasks.routes";

import {
  TeamAgentService,
} from "./modules/team-agent/team-agent.service";

import {
  createTeamAgentRouter,
} from "./modules/team-agent/team-agent.routes";

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


const rbacRepository =
  new SupabaseRbacRepository(
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


const rbacService =
  new RbacService(
    rbacRepository
  );


const auditQueryService =
  new AuditQueryService(
    rbacService,
    auditRepository
  );


const projectsService =
  new ProjectsService(
    rbacService,
    projectsRepository
  );


const discussionService =
  new DiscussionService(
    rbacService,
    discussionRepository
  );


const tasksService =
  new TasksService(
    rbacService,
    tasksRepository
  );


const teamAgentService =
  new TeamAgentService(
    rbacService,
    teamAgentRepository
  );


const teamAgentTaskMaterializationService =
  new TeamAgentTaskMaterializationService(
    rbacService,
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