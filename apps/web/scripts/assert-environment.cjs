const expectedEnvironment =
  process.argv[2];


if (
  expectedEnvironment !== "local" &&
  expectedEnvironment !== "qa"
) {
  throw new Error(
    "Expected Web environment must be local or qa."
  );
}


function required(name) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required Web environment variable: ${name}`
    );
  }

  return value;
}


const cadenceEnvironment =
  required("VITE_CADENCE_ENV");

const apiBaseUrl =
  required("VITE_API_BASE_URL");

const supabaseUrl =
  required("VITE_SUPABASE_URL");

required("VITE_SUPABASE_PUBLIC_KEY");

const projectId =
  required("VITE_PROJECT_ID");

const projectRef =
  process.env
    .VITE_SUPABASE_PROJECT_REF
    ?.trim() ?? "";


if (
  cadenceEnvironment !==
  expectedEnvironment
) {
  throw new Error(
    `Web command requires VITE_CADENCE_ENV=${expectedEnvironment}, but configuration declares VITE_CADENCE_ENV=${cadenceEnvironment}.`
  );
}


let parsedApiUrl;
let parsedSupabaseUrl;

try {
  parsedApiUrl =
    new URL(apiBaseUrl);

  parsedSupabaseUrl =
    new URL(supabaseUrl);
}
catch {
  throw new Error(
    "Web API and Supabase URLs must be valid URLs."
  );
}


const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


if (!uuidPattern.test(projectId)) {
  throw new Error(
    "VITE_PROJECT_ID must be a UUID."
  );
}


if (expectedEnvironment === "local") {
  const localSupabase =
    parsedSupabaseUrl.protocol === "http:" &&
    (
      parsedSupabaseUrl.hostname === "127.0.0.1" ||
      parsedSupabaseUrl.hostname === "localhost"
    ) &&
    parsedSupabaseUrl.port === "54321";

  const localApi =
    parsedApiUrl.protocol === "http:" &&
    (
      parsedApiUrl.hostname === "127.0.0.1" ||
      parsedApiUrl.hostname === "localhost"
    ) &&
    parsedApiUrl.port === "3000";

  if (!localSupabase) {
    throw new Error(
      "Local Web mode requires local Supabase on port 54321."
    );
  }

  if (!localApi) {
    throw new Error(
      "Local Web mode requires local Cadence API on port 3000."
    );
  }

  if (projectRef) {
    throw new Error(
      "Local Web mode must not declare a hosted Supabase project ref."
    );
  }
}
else {
  if (!projectRef) {
    throw new Error(
      "QA Web mode requires VITE_SUPABASE_PROJECT_REF."
    );
  }

  const expectedHost =
    `${projectRef}.supabase.co`;

  if (
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.hostname !== expectedHost
  ) {
    throw new Error(
      "QA Web Supabase URL does not match VITE_SUPABASE_PROJECT_REF."
    );
  }

  const localQaApi =
    parsedApiUrl.protocol === "http:" &&
    (
      parsedApiUrl.hostname === "127.0.0.1" ||
      parsedApiUrl.hostname === "localhost"
    ) &&
    parsedApiUrl.port === "3000";

  if (!localQaApi) {
    throw new Error(
      "QA development mode currently requires the local Cadence API on port 3000."
    );
  }
}


console.log(
  `Cadence Web environment preflight passed: ${expectedEnvironment} -> API ${parsedApiUrl.host}, Supabase ${parsedSupabaseUrl.host}`
);
