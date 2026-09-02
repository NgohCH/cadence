import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  SupabaseAdministrativeAuthProvider,
} from "../src/infrastructure/auth/supabase-administrative-auth-provider";
import type {
  AdministrativeAuthProvider,
} from "../src/infrastructure/auth/administrative-auth-provider";
import {
  SupabaseIdentityPilotPreparationRepository,
} from "../src/infrastructure/database/supabase-identity-pilot-preparation.repository";
import {
  SupabaseProjectHealthPilotPreparationRepository,
} from "../src/infrastructure/database/supabase-project-health-pilot-preparation.repository";
import {
  SupabaseProjectMemberAdmissionRepository,
} from "../src/infrastructure/database/supabase-project-member-admission.repository";
import {
  SupabaseProjectMembershipPilotPreparationRepository,
} from "../src/infrastructure/database/supabase-project-membership-pilot-preparation.repository";
import {
  SupabaseProjectMembershipRepository,
} from "../src/infrastructure/database/supabase-project-membership.repository";
import {
  SupabaseProjectRoleManagementRepository,
} from "../src/infrastructure/database/supabase-project-role-management.repository";
import {
  SupabaseProjectsPilotPreparationRepository,
} from "../src/infrastructure/database/supabase-projects-pilot-preparation.repository";
import {
  PilotPreparationService,
} from "../src/modules/identity/pilot-preparation.service";
import type {
  IdentityPilotObservationRepository,
} from "../src/modules/identity/pilot-observation.repository";
import {
  ProjectHealthPilotPreparationService,
} from "../src/modules/project-health/pilot-preparation.service";
import type {
  ProjectHealthPilotObservationRepository,
} from "../src/modules/project-health/pilot-observation.repository";
import {
  ProjectMembershipPilotPreparationService,
} from "../src/modules/project-membership/pilot-preparation.service";
import {
  ProjectsPilotPreparationService,
} from "../src/modules/projects/pilot-preparation.service";
import type {
  ProjectsPilotObservationRepository,
} from "../src/modules/projects/pilot-observation.repository";
import type {
  ControlledPilotObservationSources,
} from "./vs004-controlled-pilot-preflight";
import type {
  ControlledPilotExecutionServices,
} from "./vs004-controlled-pilot-execution";
import {
  createMembershipPilotObservationSource,
  createReadOnlyAuthAccountReader,
} from "./vs004-controlled-pilot-observation-adapters";
import type {
  ControlledPilotRuntimeConfiguration,
} from "./vs004-controlled-pilot-runtime-config";


export interface ControlledPilotRuntimeFactories {
  readonly createSupabaseClient: (
    configuration: ControlledPilotRuntimeConfiguration,
  ) => SupabaseClient;

  readonly createAdministrativeAuthProvider: (
    client: SupabaseClient,
  ) => AdministrativeAuthProvider;

  readonly createObservationSources: (input: {
    client: SupabaseClient;
    authProvider: AdministrativeAuthProvider;
  }) => ControlledPilotObservationSources;

  readonly createExecutionServices: (input: {
    client: SupabaseClient;
    authProvider: AdministrativeAuthProvider;
    configuration: ControlledPilotRuntimeConfiguration;
  }) => ControlledPilotExecutionServices;
}


export function buildControlledPilotObservationRuntime(
  configuration: ControlledPilotRuntimeConfiguration,
  factories: ControlledPilotRuntimeFactories = defaultFactories,
): ControlledPilotObservationSources {
  const client = factories.createSupabaseClient(configuration);
  const authProvider = factories.createAdministrativeAuthProvider(client);
  return factories.createObservationSources({ client, authProvider });
}


export function buildControlledPilotExecutionServices(
  configuration: ControlledPilotRuntimeConfiguration,
  factories: ControlledPilotRuntimeFactories = defaultFactories,
): ControlledPilotExecutionServices {
  const client = factories.createSupabaseClient(configuration);
  const authProvider = factories.createAdministrativeAuthProvider(client);
  const services = factories.createExecutionServices({
    client,
    authProvider,
    configuration,
  });

  return Object.freeze({
    identity: Object.freeze({
      preparePilotIdentity: (
        ...args: Parameters<typeof services.identity.preparePilotIdentity>
      ) => {
        const [intent, context, resourceActions] = args;
        return services.identity.preparePilotIdentity(
          intent,
          {
            ...context,
            password: configuration.firstAccountPassword,
          },
          resourceActions,
        );
      },
    }),
    projects: Object.freeze({
      preparePilotProject: (
        ...args: Parameters<typeof services.projects.preparePilotProject>
      ) => services.projects.preparePilotProject(...args),
    }),
    projectHealth: Object.freeze({
      preparePilotHealth: (
        ...args: Parameters<typeof services.projectHealth.preparePilotHealth>
      ) => services.projectHealth.preparePilotHealth(...args),
    }),
    membership: Object.freeze({
      prepareMembership: (
        ...args: Parameters<typeof services.membership.prepareMembership>
      ) => services.membership.prepareMembership(...args),
      prepareOrdinaryRoleAssignment: (
        ...args: Parameters<typeof services.membership.prepareOrdinaryRoleAssignment>
      ) => services.membership.prepareOrdinaryRoleAssignment(...args),
      prepareProtectedRoleAppointment: (
        ...args: Parameters<typeof services.membership.prepareProtectedRoleAppointment>
      ) => services.membership.prepareProtectedRoleAppointment(...args),
    }),
  });
}


const defaultFactories: ControlledPilotRuntimeFactories = {
  createSupabaseClient: (configuration) =>
    createClient(
      configuration.runtimeTarget.supabaseUrl,
      configuration.supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    ),

  createAdministrativeAuthProvider: (client) =>
    new SupabaseAdministrativeAuthProvider(client),

  createObservationSources: ({ client, authProvider }) => {
    const identityRepository = new SupabaseIdentityPilotPreparationRepository(client);
    const projectsRepository = new SupabaseProjectsPilotPreparationRepository(client);
    const projectHealthRepository = new SupabaseProjectHealthPilotPreparationRepository(client);
    const membershipRepository = new SupabaseProjectMembershipRepository(client);
    const membershipRoleReads = new SupabaseProjectMembershipPilotPreparationRepository(client);

    const identity: IdentityPilotObservationRepository = {
      findPersonById: (personId) => identityRepository.findPersonById(personId),
      findCadenceUserById: (userId) => identityRepository.findCadenceUserById(userId),
      listAuthenticationIdentities: (personId) =>
        identityRepository.listAuthenticationIdentities(personId),
      findAuthenticationIdentitiesByProviderSubject: (provider, providerSubjectId) =>
        identityRepository.findAuthenticationIdentitiesByProviderSubject(
          provider,
          providerSubjectId,
        ),
      findAuthenticationIdentitiesById: (identityId) =>
        identityRepository.findAuthenticationIdentitiesById(identityId),
    };
    const projects: ProjectsPilotObservationRepository = {
      findProjectById: (projectId) => projectsRepository.findProjectById(projectId),
    };
    const projectHealth: ProjectHealthPilotObservationRepository = {
      findCurrentProjectHealth: (projectId) =>
        projectHealthRepository.findCurrentProjectHealth(projectId),
    };

    return {
      auth: createReadOnlyAuthAccountReader(authProvider),
      identity,
      projects,
      projectHealth,
      membership: createMembershipPilotObservationSource({
        memberships: membershipRepository,
        roleAssignments: membershipRoleReads,
        protectedTransfers: membershipRoleReads,
      }),
    };
  },

  createExecutionServices: ({ client, authProvider }) => {
    const identityRepository = new SupabaseIdentityPilotPreparationRepository(client);
    const projectsRepository = new SupabaseProjectsPilotPreparationRepository(client);
    const projectHealthRepository = new SupabaseProjectHealthPilotPreparationRepository(client);
    const membershipRepository = new SupabaseProjectMembershipRepository(client);
    const admissionRepository = new SupabaseProjectMemberAdmissionRepository(client);
    const roleManagementRepository = new SupabaseProjectRoleManagementRepository(client);
    const membershipRoleReads = new SupabaseProjectMembershipPilotPreparationRepository(client);

    return {
      identity: new PilotPreparationService(identityRepository, authProvider),
      projects: new ProjectsPilotPreparationService(projectsRepository),
      projectHealth: new ProjectHealthPilotPreparationService(projectHealthRepository),
      membership: new ProjectMembershipPilotPreparationService(
        membershipRepository,
        admissionRepository,
        roleManagementRepository,
        membershipRoleReads,
        membershipRoleReads,
      ),
    };
  },
};
