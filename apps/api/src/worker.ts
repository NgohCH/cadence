import {
  createClient,
} from "@supabase/supabase-js";

import {
  SupabaseAuditRepository,
} from "./infrastructure/database/supabase-audit.repository";

import {
  SupabaseDiscussionRepository,
} from "./infrastructure/database/supabase-discussion.repository";

import {
  SupabaseDomainEventRepository,
} from "./infrastructure/database/supabase-domain-event.repository";

import {
  SupabaseRbacRepository,
} from "./infrastructure/database/supabase-rbac.repository";

import {
  SupabaseTeamAgentRepository,
} from "./infrastructure/database/supabase-team-agent.repository";

import {
  DomainEventProcessor,
} from "./infrastructure/events/domain-event.processor";

import {
  AuditDomainEventHandler,
} from "./modules/audit/audit-domain-event.handler";

import {
  AuditService,
} from "./modules/audit/audit.service";

import {
  DiscussionService,
} from "./modules/discussion/discussion.service";

import {
  RbacService,
} from "./modules/rbac/rbac.service";

import {
  MessageCreatedV1Handler,
} from "./modules/team-agent/message-created.handler";

import {
  TeamAgentService,
} from "./modules/team-agent/team-agent.service";


const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;


if (
  !supabaseUrl ||
  !supabaseSecretKey
) {
  throw new Error(
    "Missing required Supabase worker environment variables."
  );
}


/*
 * Infrastructure
 */

const databaseClient =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );


const auditRepository =
  new SupabaseAuditRepository(
    databaseClient
  );

const domainEventRepository =
  new SupabaseDomainEventRepository(
    databaseClient
  );

const discussionRepository =
  new SupabaseDiscussionRepository(
    databaseClient
  );

const rbacRepository =
  new SupabaseRbacRepository(
    databaseClient
  );

const teamAgentRepository =
  new SupabaseTeamAgentRepository(
    databaseClient
  );


/*
 * Application services
 */

const auditService =
  new AuditService(
    auditRepository
  );

const rbacService =
  new RbacService(
    rbacRepository
  );

const discussionService =
  new DiscussionService(
    rbacService,
    discussionRepository
  );

const teamAgentService =
  new TeamAgentService(
    rbacService,
    teamAgentRepository
  );


/*
 * Event handlers
 */

const auditDomainEventHandler =
  new AuditDomainEventHandler(
    auditService
  );

const messageCreatedHandler =
  new MessageCreatedV1Handler(
    discussionService,
    teamAgentService
  );


/*
 * Event processor
 */

const processor =
  new DomainEventProcessor(
    domainEventRepository
  );


async function main(): Promise<void> {
  /*
   * Audit and Team Agent are independent domain-event consumers.
   *
   * Each invocation processes at most one pending delivery for each
   * consumer. Repeated worker invocations drain additional work.
   *
   * Audit is attempted first so the committed business action can be
   * recorded independently even if a downstream Team Agent operation
   * later fails.
   */
  const auditProcessed =
    await processor.processNext(
      auditDomainEventHandler
    );


  const teamAgentProcessed =
    await processor.processNext(
      messageCreatedHandler
    );


  if (
    !auditProcessed &&
    !teamAgentProcessed
  ) {
    console.log(
      "Cadence worker: no pending domain-event deliveries."
    );

    return;
  }


  if (auditProcessed) {
    console.log(
      "Cadence worker: processed one Audit delivery."
    );
  }


  if (teamAgentProcessed) {
    console.log(
      "Cadence worker: processed one Team Agent delivery."
    );
  }
}


main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown worker error.";

    console.error(
      `Cadence worker failed: ${message}`
    );

    process.exitCode = 1;
  }
);