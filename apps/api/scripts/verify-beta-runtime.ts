import {
  createClient,
} from "@supabase/supabase-js";

import {
  validateCadenceEnvironmentSafety,
} from "../src/bootstrap/environment-safety";


function required(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${name}`
    );
  }

  return value;
}


async function main(): Promise<void> {

  const supabaseUrl =
    required("SUPABASE_URL");

  const publishableKey =
    required(
      "SUPABASE_PUBLISHABLE_KEY"
    );

  const secretKey =
    required(
      "SUPABASE_SECRET_KEY"
    );


  const safety =
    validateCadenceEnvironmentSafety({
      cadenceEnv:
        process.env.CADENCE_ENV,

      supabaseUrl,

      supabaseProjectRef:
        process.env
          .CADENCE_SUPABASE_PROJECT_REF,
    });


  if (
    safety.cadenceEnv !== "beta"
  ) {
    throw new Error(
      "Beta verification may run only against CADENCE_ENV=beta."
    );
  }


  const service =
    createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );


  const anonymous =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );


  /*
   * Critical schema existence through service-role access.
   */
  const criticalTables = [
    "persons",
    "authentication_identities",
    "organisational_affiliations",
    "project_memberships",
    "project_role_assignments",
    "project_role_transfers",
    "domain_events",
    "domain_event_deliveries",
    "domain_event_subscriptions",
  ];


  for (
    const table of criticalTables
  ) {
    const {
      error,
    } =
      await service
        .from(table)
        .select("*", {
          head: true,
          count: "exact",
        });

    if (error) {
      throw new Error(
        `Critical Beta table unavailable: ${table}: ${error.message}`
      );
    }
  }


  /*
   * Beta must begin without application/project data.
   */
  for (
    const table of [
      "persons",
      "project_memberships",
      "project_role_assignments",
      "project_role_transfers",
      "domain_events",
    ]
  ) {
    const {
      count,
      error,
    } =
      await service
        .from(table)
        .select("*", {
          head: true,
          count: "exact",
        });

    if (error) {
      throw new Error(
        `Unable to inspect Beta table ${table}: ${error.message}`
      );
    }

    if (count !== 0) {
      throw new Error(
        `Fresh Beta invariant failed: ${table} contains ${count} row(s).`
      );
    }
  }


  /*
   * Event-consumer configuration is migration-owned and should
   * therefore already exist even in an otherwise empty Beta.
   */
  const {
    count: subscriptionCount,
    error: subscriptionError,
  } =
    await service
      .from(
        "domain_event_subscriptions"
      )
      .select("*", {
        head: true,
        count: "exact",
      });


  if (subscriptionError) {
    throw new Error(
      `Unable to inspect domain-event subscriptions: ${subscriptionError.message}`
    );
  }


  if (
    subscriptionCount === null ||
    subscriptionCount === 0
  ) {
    throw new Error(
      "Beta has no domain-event subscriptions."
    );
  }


  /*
   * Anonymous browser access must not expose stable identity
   * or membership persistence.
   *
   * Either an explicit permission error OR an empty RLS result
   * is acceptable. Returning rows is not.
   */
  for (
    const table of [
      "persons",
      "authentication_identities",
      "project_role_assignments",
    ]
  ) {
    const {
      data,
    } =
      await anonymous
        .from(table)
        .select("*")
        .limit(1);

    if (
      data &&
      data.length > 0
    ) {
      throw new Error(
        `Anonymous Beta access exposed ${table}.`
      );
    }
  }


  console.log(
    "Cadence Beta runtime verification passed."
  );

  console.log(
    `Critical tables verified: ${criticalTables.length}`
  );

  console.log(
    `Domain-event subscriptions present: ${subscriptionCount}`
  );

  console.log(
    "Fresh Beta application data: empty"
  );

  console.log(
    "Anonymous sensitive-table exposure: none"
  );
}


main().catch(
  (error: unknown) => {

    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode =
      1;
  }
);
