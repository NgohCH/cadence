import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
  type CadenceEnvironment,
} from "../src/bootstrap/cadence-config";

export interface ResolvedPilotRuntimeTarget {
  readonly cadenceEnv: CadenceEnvironment;
  readonly supabaseUrl: string;
  readonly supabaseProjectRef: string | null;
  readonly projectId: string;
  readonly safeTargetMarker: string;
}

export interface ControlledPilotRuntimeConfiguration {
  readonly runtimeTarget: ResolvedPilotRuntimeTarget;
  readonly supabaseSecretKey: string;
  readonly firstAccountPassword: string | undefined;
}

export function loadControlledPilotRuntimeConfiguration(
  environment: NodeJS.ProcessEnv,
): ControlledPilotRuntimeConfiguration {
  const configPath = resolveCadenceConfigPath({
    argv: [],
    environment,
  });
  const config = loadCadenceRuntimeConfig(configPath);
  const { supabaseSecretKey } = resolveCadenceSecrets(config, environment);

  const runtimeTarget: ResolvedPilotRuntimeTarget = Object.freeze({
    cadenceEnv: config.application.environment,
    supabaseUrl: config.supabase.url,
    supabaseProjectRef: config.supabase.projectRef,
    projectId: config.pilot.projectId,
    safeTargetMarker: config.pilot.safeTargetMarker,
  });

  return Object.freeze({
    runtimeTarget,
    supabaseSecretKey,
    firstAccountPassword: optionalEnvironmentValue(
      environment.CADENCE_LOCAL_DEV_PASSWORD,
    ),
  });
}

function optionalEnvironmentValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
