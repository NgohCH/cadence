import {
  validateCadenceEnvironmentSafety,
  type CadenceEnvironmentSafetyInput,
} from "../src/bootstrap/environment-safety";
import type { PilotRuntimeTarget } from "./vs004-preflight";


export interface ControlledPilotRuntimeConfiguration {
  readonly runtimeTarget: PilotRuntimeTarget;
  readonly supabaseSecretKey: string;
  readonly firstAccountPassword: string | undefined;
}


export function loadControlledPilotRuntimeConfiguration(
  environment: NodeJS.ProcessEnv,
): ControlledPilotRuntimeConfiguration {
  const cadenceEnv = requiredEnvironmentValue(environment, "CADENCE_ENV");
  const supabaseUrl = requiredEnvironmentValue(environment, "SUPABASE_URL");
  const safeTargetMarker = requiredEnvironmentValue(
    environment,
    "CADENCE_SAFE_TARGET_MARKER",
  );
  const projectId = requiredEnvironmentValue(environment, "CADENCE_PILOT_PROJECT_ID");
  const supabaseSecretKey = requiredEnvironmentValue(
    environment,
    "SUPABASE_SECRET_KEY",
  );

  const safetyInput: CadenceEnvironmentSafetyInput = {
    cadenceEnv,
    supabaseUrl,
    supabaseProjectRef: environment.CADENCE_SUPABASE_PROJECT_REF,
  };
  const safety = validateCadenceEnvironmentSafety(safetyInput);
  const runtimeTarget: PilotRuntimeTarget = Object.freeze({
    cadenceEnv: safety.cadenceEnv,
    supabaseUrl: safety.supabaseUrl,
    supabaseProjectRef: safety.supabaseProjectRef,
    projectId,
    safeTargetMarker,
  });

  const firstAccountPassword = optionalEnvironmentValue(
    environment.CADENCE_LOCAL_DEV_PASSWORD,
  );

  return Object.freeze({
    runtimeTarget,
    supabaseSecretKey,
    firstAccountPassword,
  });
}


function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for controlled pilot runtime configuration.`);
  }
  return value;
}


function optionalEnvironmentValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
