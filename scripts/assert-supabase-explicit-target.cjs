const TARGETS = {
  beta: {
    projectRef: "pwmhasbmacmeerbsagda",
  },
};

function validateExplicitRemoteTarget(expectedEnvironment) {
  const target =
    TARGETS[expectedEnvironment];

  if (!target) {
    throw new Error(
      "Explicit remote targeting currently supports only beta."
    );
  }

  const cadenceEnv =
    process.env.CADENCE_ENV?.trim();

  const projectRef =
    process.env.CADENCE_SUPABASE_PROJECT_REF?.trim();

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim();

  const dbPassword =
    process.env.SUPABASE_DB_PASSWORD;

  if (cadenceEnv !== expectedEnvironment) {
    throw new Error(
      `Remote command requires CADENCE_ENV=${expectedEnvironment}.`
    );
  }

  if (projectRef !== target.projectRef) {
    throw new Error(
      `Beta project-ref mismatch. Expected ${target.projectRef}.`
    );
  }

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is required."
    );
  }

  let parsedUrl;

  try {
    parsedUrl =
      new URL(supabaseUrl);
  }
  catch {
    throw new Error(
      "SUPABASE_URL must be valid."
    );
  }

  const expectedHost =
    `${target.projectRef}.supabase.co`;

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== expectedHost
  ) {
    throw new Error(
      "Beta SUPABASE_URL does not match the committed Beta project ref."
    );
  }

  if (!dbPassword) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is required for the Beta database command."
    );
  }

  return {
    environment:
      expectedEnvironment,

    projectRef:
      target.projectRef,
  };
}

if (require.main === module) {
  try {
    const target =
      validateExplicitRemoteTarget(
        process.argv[2]
      );

    console.log(
      `Cadence explicit remote target preflight passed: ${target.environment} -> ${target.projectRef}`
    );
  }
  catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode = 1;
  }
}

module.exports = {
  validateExplicitRemoteTarget,
};
