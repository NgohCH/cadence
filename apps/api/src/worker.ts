import {
  createClient,
} from "@supabase/supabase-js";

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
    teamAgentRepository
  );


/*
 * Event handlers
 */

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
  const processed =
    await processor.processNext(
      messageCreatedHandler
    );

  if (!processed) {
    console.log(
      "Cadence worker: no pending Team Agent delivery."
    );

    return;
  }

  console.log(
    "Cadence worker: processed one Team Agent delivery."
  );
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