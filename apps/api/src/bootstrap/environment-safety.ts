export type CadenceEnvironment =
  | "local"
  | "qa"
  | "beta";


export interface CadenceEnvironmentSafetyInput {
  cadenceEnv:
    string | undefined;

  supabaseUrl:
    string | undefined;

  supabaseProjectRef:
    string | undefined;
}


export interface CadenceEnvironmentSafety {
  cadenceEnv:
    CadenceEnvironment;

  supabaseUrl:
    string;

  supabaseProjectRef:
    string | null;
}


const LOCAL_SUPABASE_PORT =
  "54321";


export function validateCadenceEnvironmentSafety(
  input: CadenceEnvironmentSafetyInput
): CadenceEnvironmentSafety {
  const cadenceEnv =
    parseCadenceEnvironment(
      input.cadenceEnv
    );

  const supabaseUrl =
    requireValue(
      input.supabaseUrl,
      "SUPABASE_URL"
    );

  const parsedUrl =
    parseSupabaseUrl(
      supabaseUrl
    );

  if (cadenceEnv === "local") {
    validateLocalSupabaseUrl(
      parsedUrl
    );

    if (
      hasValue(
        input.supabaseProjectRef
      )
    ) {
      throw new Error(
        "CADENCE_SUPABASE_PROJECT_REF must not be set when CADENCE_ENV=local."
      );
    }

    return {
      cadenceEnv,
      supabaseUrl,
      supabaseProjectRef:
        null,
    };
  }

  const projectRef =
    requireValue(
      input.supabaseProjectRef,
      "CADENCE_SUPABASE_PROJECT_REF"
    );

  validateHostedSupabaseUrl(
    parsedUrl,
    projectRef,
    cadenceEnv
  );

  return {
    cadenceEnv,
    supabaseUrl,
    supabaseProjectRef:
      projectRef,
  };
}


function parseCadenceEnvironment(
  value: string | undefined
): CadenceEnvironment {
  const normalized =
    value?.trim().toLowerCase();

  if (
    normalized === "local" ||
    normalized === "qa" ||
    normalized === "beta"
  ) {
    return normalized;
  }

  throw new Error(
    "CADENCE_ENV must be explicitly set to local, qa, or beta."
  );
}


function parseSupabaseUrl(
  value: string
): URL {
  try {
    return new URL(
      value
    );
  } catch {
    throw new Error(
      "SUPABASE_URL must be a valid URL."
    );
  }
}


function validateLocalSupabaseUrl(
  url: URL
): void {
  const isLoopbackHost =
    url.hostname ===
      "127.0.0.1" ||
    url.hostname ===
      "localhost";

  if (
    url.protocol !== "http:" ||
    !isLoopbackHost ||
    url.port !==
      LOCAL_SUPABASE_PORT
  ) {
    throw new Error(
      "CADENCE_ENV=local requires SUPABASE_URL to use the local Supabase API on http://127.0.0.1:54321 or http://localhost:54321."
    );
  }
}


function validateHostedSupabaseUrl(
  url: URL,
  projectRef: string,
  cadenceEnv:
    Exclude<
      CadenceEnvironment,
      "local"
    >
): void {
  if (
    !/^[a-z0-9]+$/i.test(
      projectRef
    )
  ) {
    throw new Error(
      "CADENCE_SUPABASE_PROJECT_REF contains invalid characters."
    );
  }

  const expectedHost =
    `${projectRef}.supabase.co`;

  if (
    url.protocol !== "https:" ||
    url.hostname !== expectedHost
  ) {
    throw new Error(
      `CADENCE_ENV=${cadenceEnv} requires SUPABASE_URL to match the declared Supabase project ref.`
    );
  }
}


function requireValue(
  value: string | undefined,
  name: string
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${name} is required.`
    );
  }

  return normalized;
}


function hasValue(
  value: string | undefined
): boolean {
  return Boolean(
    value?.trim()
  );
}
