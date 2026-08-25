const fs = require("node:fs");
const path = require("node:path");


const expectedEnvironment =
  process.argv[2];


if (
  expectedEnvironment !== "qa" &&
  expectedEnvironment !== "beta"
) {
  throw new Error(
    "Remote Supabase link validation supports only qa or beta."
  );
}


const cadenceEnv =
  process.env.CADENCE_ENV?.trim();

const expectedProjectRef =
  process.env.CADENCE_SUPABASE_PROJECT_REF?.trim();

const supabaseUrl =
  process.env.SUPABASE_URL?.trim();


if (
  cadenceEnv !==
    expectedEnvironment
) {
  throw new Error(
    `Remote database command requires CADENCE_ENV=${expectedEnvironment}.`
  );
}


if (!expectedProjectRef) {
  throw new Error(
    "CADENCE_SUPABASE_PROJECT_REF is required for a remote database command."
  );
}


if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL is required for a remote database command."
  );
}


let parsedUrl;

try {
  parsedUrl =
    new URL(
      supabaseUrl
    );
} catch {
  throw new Error(
    "SUPABASE_URL must be a valid URL."
  );
}


const expectedHost =
  `${expectedProjectRef}.supabase.co`;


if (
  parsedUrl.protocol !== "https:" ||
  parsedUrl.hostname !== expectedHost
) {
  throw new Error(
    "SUPABASE_URL does not match CADENCE_SUPABASE_PROJECT_REF."
  );
}


const projectRefPath =
  path.resolve(
    process.cwd(),
    "supabase",
    ".temp",
    "project-ref"
  );


if (
  !fs.existsSync(
    projectRefPath
  )
) {
  throw new Error(
    "Supabase CLI is not linked to a remote project."
  );
}


const linkedProjectRef =
  fs.readFileSync(
    projectRefPath,
    "utf8"
  ).trim();


if (
  linkedProjectRef !==
    expectedProjectRef
) {
  throw new Error(
    `Supabase CLI link mismatch: expected ${expectedProjectRef}, found ${linkedProjectRef || "<empty>"}.`
  );
}


console.log(
  `Cadence remote database preflight passed: ${expectedEnvironment} -> ${linkedProjectRef}`
);
