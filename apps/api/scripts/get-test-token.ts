import { createClient } from "@supabase/supabase-js";

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

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