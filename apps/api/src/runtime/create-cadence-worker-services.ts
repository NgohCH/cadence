import { createClient } from "@supabase/supabase-js";

import type {
  CadenceResolvedSecrets,
  CadenceRuntimeConfig,
} from "../bootstrap/cadence-config";
import { SupabaseAuditRepository } from "../infrastructure/database/supabase-audit.repository";
import { SupabaseDiscussionRepository } from "../infrastructure/database/supabase-discussion.repository";
import { SupabaseDomainEventRepository } from "../infrastructure/database/supabase-domain-event.repository";
import { SupabaseProjectMembershipLifecycleRepository } from "../infrastructure/database/supabase-project-membership-lifecycle.repository";
import { SupabaseProjectMembershipRepository } from "../infrastructure/database/supabase-project-membership.repository";
import { SupabaseTeamAgentRepository } from "../infrastructure/database/supabase-team-agent.repository";
import { DomainEventProcessor } from "../infrastructure/events/domain-event.processor";
import { AuditDomainEventHandler } from "../modules/audit/audit-domain-event.handler";
import { AuditService } from "../modules/audit/audit.service";
import { DiscussionService } from "../modules/discussion/discussion.service";
import { ProjectAuthorisationService } from "../modules/project-membership/project-authorisation.service";
import { ProjectMembershipExpiryProcessor } from "../modules/project-membership/project-membership-expiry.processor";
import { MessageCreatedV1Handler } from "../modules/team-agent/message-created.handler";
import { TeamAgentService } from "../modules/team-agent/team-agent.service";
import type { CadenceWorkerCycleServices } from "./cadence-worker-cycle";

export function createCadenceWorkerServices(input: {
  config: CadenceRuntimeConfig;
  secrets: CadenceResolvedSecrets;
}): CadenceWorkerCycleServices {
  const databaseClient = createClient(
    input.config.supabase.url,
    input.secrets.supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  const auditRepository = new SupabaseAuditRepository(databaseClient);
  const domainEventRepository = new SupabaseDomainEventRepository(databaseClient);
  const discussionRepository = new SupabaseDiscussionRepository(databaseClient);
  const teamAgentRepository = new SupabaseTeamAgentRepository(databaseClient);
  const projectMembershipLifecycleRepository = new SupabaseProjectMembershipLifecycleRepository(databaseClient);
  const projectMembershipRepository = new SupabaseProjectMembershipRepository(databaseClient);

  const auditService = new AuditService(auditRepository);
  const projectAuthorisationService = new ProjectAuthorisationService(projectMembershipRepository);
  const discussionService = new DiscussionService(
    projectAuthorisationService,
    discussionRepository,
  );
  const teamAgentService = new TeamAgentService(
    projectAuthorisationService,
    teamAgentRepository,
  );
  const membershipExpiryProcessor = new ProjectMembershipExpiryProcessor(
    projectMembershipLifecycleRepository,
  );

  const auditDomainEventHandler = new AuditDomainEventHandler(auditService);
  const messageCreatedHandler = new MessageCreatedV1Handler(
    discussionService,
    teamAgentService,
  );
  const processor = new DomainEventProcessor(domainEventRepository);

  return {
    processMembershipExpiry: (maxMemberships) =>
      membershipExpiryProcessor.processDueMemberships(maxMemberships),
    processAuditNext: () => processor.processNext(auditDomainEventHandler),
    processTeamAgentNext: () => processor.processNext(messageCreatedHandler),
  };
}
