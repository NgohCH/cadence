import { createClient } from "@supabase/supabase-js";
import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
} from "../src/bootstrap/cadence-config";

async function main(): Promise<void> {
  const configPath = resolveCadenceConfigPath({
    argv: process.argv.slice(2),
    environment: process.env,
  });
  const config = loadCadenceRuntimeConfig(configPath);
  const supabaseUrl = config.supabase.url;
  const publishableKey = config.supabase.publishableKey;

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (
    !supabaseUrl ||
    !publishableKey ||
    !email ||
    !password
  ) {
    throw new Error(
      "Missing required environment variables."
    );
  }

  const supabase = createClient(
    supabaseUrl,
    publishableKey
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  if (!data.session?.access_token) {
    throw new Error(
      "Login succeeded but no access token was returned."
    );
  }

  console.log(data.session.access_token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
