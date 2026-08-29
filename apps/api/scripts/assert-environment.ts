import {
  validateCadenceEnvironmentSafety,
} from "../src/bootstrap/environment-safety";


const expectedEnvironment =
  process.argv[2];


if (
  expectedEnvironment !== "local" &&
  expectedEnvironment !== "qa" &&
  expectedEnvironment !== "beta"
) {
  throw new Error(
    "Expected environment argument must be local, qa, or beta."
  );
}


const validated =
  validateCadenceEnvironmentSafety({
    cadenceEnv:
      process.env.CADENCE_ENV,

    supabaseUrl:
      process.env.SUPABASE_URL,

    supabaseProjectRef:
      process.env.CADENCE_SUPABASE_PROJECT_REF,
  });


if (
  validated.cadenceEnv !==
    expectedEnvironment
) {
  throw new Error(
    `Command requires CADENCE_ENV=${expectedEnvironment}, but configuration declares CADENCE_ENV=${validated.cadenceEnv}.`
  );
}


const supabaseHost =
  new URL(
    validated.supabaseUrl
  ).host;


console.log(
  `Cadence environment preflight passed: ${validated.cadenceEnv} -> ${supabaseHost}`
);
