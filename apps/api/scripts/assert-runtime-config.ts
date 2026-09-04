import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  type CadenceEnvironment,
} from "../src/bootstrap/cadence-config";

export interface RuntimeTargetIdentity {
  environment: CadenceEnvironment;
  supabaseUrl: string;
  supabaseProjectRef: string | null;
}

export function assertRuntimeConfig(input: {
  expectedEnvironment: CadenceEnvironment;
  configPath: string;
}): RuntimeTargetIdentity {
  const config = loadCadenceRuntimeConfig(input.configPath);

  if (config.application.environment !== input.expectedEnvironment) {
    throw new Error(
      `Command requires environment ${input.expectedEnvironment}, but canonical configuration declares ${config.application.environment}.`,
    );
  }

  return {
    environment: config.application.environment,
    supabaseUrl: config.supabase.url,
    supabaseProjectRef: config.supabase.projectRef,
  };
}

function parseExpectedEnvironment(value: string | undefined): CadenceEnvironment {
  if (value === "local" || value === "qa" || value === "beta") {
    return value;
  }
  throw new Error("--env must be local, qa, or beta");
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  try {
    const expectedEnvironment = parseExpectedEnvironment(
      argumentValue("--env") ?? process.argv[2],
    );
    const configPath = resolveCadenceConfigPath({
      argv: process.argv.slice(2),
      environment: process.env,
    });
    const target = assertRuntimeConfig({ expectedEnvironment, configPath });
    console.log(
      `Cadence runtime configuration passed: ${target.environment} -> ${new URL(target.supabaseUrl).host}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
