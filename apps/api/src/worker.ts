import {
  validateCadenceEnvironmentSafety,
} from "./bootstrap/environment-safety";
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
  SupabaseTeamAgentRepository,
} from "./infrastructure/database/supabase-team-agent.repository";

import {
  SupabaseProjectMembershipLifecycleRepository,
} from "./infrastructure/database/supabase-project-membership-lifecycle.repository";

import {
  SupabaseProjectMembershipRepository,
} from "./infrastructure/database/supabase-project-membership.repository";

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
  ProjectMembershipExpiryProcessor,
} from "./modules/project-membership/project-membership-expiry.processor";

import {
  ProjectAuthorisationService,
} from "./modules/project-membership/project-authorisation.service";

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

validateCadenceEnvironmentSafety({
  cadenceEnv:
    process.env.CADENCE_ENV,

  supabaseUrl,

  supabaseProjectRef:
    process.env.CADENCE_SUPABASE_PROJECT_REF,
});

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

const teamAgentRepository =
  new SupabaseTeamAgentRepository(
    databaseClient
  );

const projectMembershipLifecycleRepository =
  new SupabaseProjectMembershipLifecycleRepository(
    databaseClient
  );

const projectMembershipRepository =
  new SupabaseProjectMembershipRepository(
    databaseClient
  );


/*
 * Application services
 */

const auditService =
  new AuditService(
    auditRepository
  );

const projectAuthorisationService =
  new ProjectAuthorisationService(
    projectMembershipRepository
  );

const discussionService =
  new DiscussionService(
    projectAuthorisationService,
    discussionRepository
  );

const teamAgentService =
  new TeamAgentService(
    projectAuthorisationService,
    teamAgentRepository
  );

const membershipExpiryProcessor =
  new ProjectMembershipExpiryProcessor(
    projectMembershipLifecycleRepository
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
  const expiryResult =
    await membershipExpiryProcessor
      .processDueMemberships();

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
    expiryResult.finalised.length === 0 &&
    expiryResult.conflicts.length === 0 &&
    !auditProcessed &&
    !teamAgentProcessed
  ) {
    console.log(
      "Cadence worker: no pending domain-event deliveries."
    );

    return;
  }


  if (expiryResult.finalised.length > 0) {
    console.log(
      `Cadence worker: finalised ${expiryResult.finalised.length} membership expiry transition(s).`
    );
  }


  if (expiryResult.conflicts.length > 0) {
    console.warn(
      `Cadence worker: ${expiryResult.conflicts.length} membership expiry conflict(s) require administrative resolution.`
    );
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
