import {
  createClient,
} from "@supabase/supabase-js";

import {
  validateCadenceEnvironmentSafety,
} from "../src/bootstrap/environment-safety";


const PERSON_ID =
  "10ca1000-0000-4000-8000-000000000001";

const USER_ID =
  "10ca2000-0000-4000-8000-000000000001";

const PROJECT_ID =
  "10ca3000-0000-4000-8000-000000000001";

const MEMBERSHIP_ID =
  "10ca4000-0000-4000-8000-000000000001";

const MEMBER_ASSIGNMENT_ID =
  "10ca5000-0000-4000-8000-000000000001";

const OWNER_ASSIGNMENT_ID =
  "10ca5000-0000-4000-8000-000000000002";

const MANAGER_ASSIGNMENT_ID =
  "10ca5000-0000-4000-8000-000000000003";

const AFFILIATION_ID =
  "10ca6000-0000-4000-8000-000000000001";

const ADMISSION_CORRELATION_ID =
  "10ca7000-0000-4000-8000-000000000001";

const OWNER_CORRELATION_ID =
  "10ca7000-0000-4000-8000-000000000002";

const MANAGER_CORRELATION_ID =
  "10ca7000-0000-4000-8000-000000000003";

const OWNER_TRANSFER_ID =
  "10ca8000-0000-4000-8000-000000000001";

const MANAGER_TRANSFER_ID =
  "10ca8000-0000-4000-8000-000000000002";


const BASELINE_AT =
  "2026-08-25T00:00:00.000Z";


type ProtectedRole =
  | "PROJECT_OWNER"
  | "PROJECT_MANAGER";


function requiredEnvironment(
  name: string
): string {

  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required local bootstrap environment variable: ${name}`
    );
  }

  return value;
}


function throwSupabaseError(
  context: string,
  error: {
    message: string;
  }
): never {

  throw new Error(
    `${context}: ${error.message}`
  );
}


async function main(): Promise<void> {

  const supabaseUrl =
    requiredEnvironment(
      "SUPABASE_URL"
    );

  const publishableKey =
    requiredEnvironment(
      "SUPABASE_PUBLISHABLE_KEY"
    );

  const secretKey =
    requiredEnvironment(
      "SUPABASE_SECRET_KEY"
    );

  const email =
    requiredEnvironment(
      "CADENCE_LOCAL_DEV_EMAIL"
    ).toLowerCase();

  const password =
    requiredEnvironment(
      "CADENCE_LOCAL_DEV_PASSWORD"
    );


  const safety =
    validateCadenceEnvironmentSafety({
      cadenceEnv:
        process.env.CADENCE_ENV,

      supabaseUrl,

      supabaseProjectRef:
        process.env.CADENCE_SUPABASE_PROJECT_REF,
    });


  if (
    safety.cadenceEnv !==
    "local"
  ) {
    throw new Error(
      "Local development bootstrap may run only in CADENCE_ENV=local."
    );
  }


  /*
   * A bootstrap account must be obviously non-production.
   */
  if (
    !email.endsWith(".test")
  ) {
    throw new Error(
      "CADENCE_LOCAL_DEV_EMAIL must use the reserved .test domain."
    );
  }


  if (
    password.length < 16
  ) {
    throw new Error(
      "CADENCE_LOCAL_DEV_PASSWORD must contain at least 16 characters."
    );
  }


  const admin =
    createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );


  /*
   * ----------------------------------------------------------
   * Supabase Auth
   * ----------------------------------------------------------
   */

  const {
    data: usersPage,
    error: listUsersError,
  } =
    await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });


  if (listUsersError) {
    throwSupabaseError(
      "Unable to list local Supabase Auth users",
      listUsersError
    );
  }


  let authUser =
    usersPage.users.find(
      (candidate) =>
        candidate.email?.toLowerCase() ===
        email
    );


  if (authUser) {

    const {
      data,
      error,
    } =
      await admin.auth.admin
        .updateUserById(
          authUser.id,
          {
            password,
          }
        );


    if (error) {
      throwSupabaseError(
        "Unable to update local Supabase Auth user",
        error
      );
    }


    authUser =
      data.user;

  } else {

    const {
      data,
      error,
    } =
      await admin.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,

          user_metadata: {
            cadence_local_development:
              true,
          },
        });


    if (
      error ||
      !data.user
    ) {
      throwSupabaseError(
        "Unable to create local Supabase Auth user",
        error ?? {
          message:
            "Supabase returned no Auth user.",
        }
      );
    }


    authUser =
      data.user;
  }


  /*
   * ----------------------------------------------------------
   * Stable Identity
   * ----------------------------------------------------------
   */

  {
    const {
      error,
    } =
      await admin
        .from("persons")
        .upsert(
          {
            id:
              PERSON_ID,

            display_name:
              "Cadence Local Admin",
          },
          {
            onConflict:
              "id",
          }
        );


    if (error) {
      throwSupabaseError(
        "Unable to bootstrap Person",
        error
      );
    }
  }


  {
    const {
      error,
    } =
      await admin
        .from("users")
        .upsert(
          {
            id:
              USER_ID,

            auth_user_id:
              authUser.id,

            username:
              "local_admin",

            display_name:
              "Cadence Local Admin",

            email,

            status:
              "active",

            identity_provider:
              "local",

            external_user_id:
              null,

            person_id:
              PERSON_ID,
          },
          {
            onConflict:
              "id",
          }
        );


    if (error) {
      throwSupabaseError(
        "Unable to bootstrap Cadence user",
        error
      );
    }
  }


  {
    const {
      data: identities,
      error,
    } =
      await admin
        .from(
          "authentication_identities"
        )
        .select(`
          id,
          provider_subject_id
        `)
        .eq(
          "person_id",
          PERSON_ID
        )
        .eq(
          "status",
          "ACTIVE"
        );


    if (error) {
      throwSupabaseError(
        "Unable to inspect authentication identities",
        error
      );
    }


    const conflictingIdentity =
      identities?.find(
        (identity) =>
          identity.provider_subject_id !==
          authUser.id
      );


    if (conflictingIdentity) {
      throw new Error(
        "Local Person is linked to a different active authentication identity. Run db:local:rebuild rather than rewriting identity history."
      );
    }


    const currentIdentity =
      identities?.find(
        (identity) =>
          identity.provider_subject_id ===
          authUser.id
      );


    if (!currentIdentity) {

      const {
        error: insertError,
      } =
        await admin
          .from(
            "authentication_identities"
          )
          .insert({
            id:
              authUser.id,

            person_id:
              PERSON_ID,

            provider:
              "local",

            provider_subject_id:
              authUser.id,

            login_identifier:
              email,

            valid_from:
              BASELINE_AT,

            valid_to:
              null,

            status:
              "ACTIVE",

            created_at:
              BASELINE_AT,
          });


      if (insertError) {
        throwSupabaseError(
          "Unable to bootstrap AuthenticationIdentity",
          insertError
        );
      }
    }
  }


  /*
   * ----------------------------------------------------------
   * Organisational affiliation
   * ----------------------------------------------------------
   */

  {
    const {
      error,
    } =
      await admin
        .from(
          "organisational_affiliations"
        )
        .upsert(
          {
            id:
              AFFILIATION_ID,

            person_id:
              PERSON_ID,

            classification:
              "INTERNAL",

            organisation_name:
              "Cadence Local Development",

            effective_from:
              BASELINE_AT,

            effective_to:
              null,

            created_at:
              BASELINE_AT,
          },
          {
            onConflict:
              "id",
          }
        );


    if (error) {
      throwSupabaseError(
        "Unable to bootstrap organisational affiliation",
        error
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * Project
   * ----------------------------------------------------------
   */

  {
    const {
      error,
    } =
      await admin
        .from("projects")
        .upsert(
          {
            id:
              PROJECT_ID,

            name:
              "Cadence Local Development Project",

            description:
              "Deterministic local-only Cadence development project.",

            goal:
              "Exercise the local Web, Auth, API and database stack.",

            lifecycle_status:
              "active",

            progress_percent:
              0,

            owner_user_id:
              USER_ID,

            start_date:
              "2026-08-25",

            target_date:
              null,
          },
          {
            onConflict:
              "id",
          }
        );


    if (error) {
      throwSupabaseError(
        "Unable to bootstrap local Project",
        error
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * Membership + initial ordinary role
   *
   * Use the canonical transactional RPC so the bootstrap does
   * not invent a second membership persistence path.
   * ----------------------------------------------------------
   */

  {
    const {
      data: membership,
      error,
    } =
      await admin
        .from(
          "project_memberships"
        )
        .select(`
          id,
          project_id,
          person_id,
          membership_status
        `)
        .eq(
          "id",
          MEMBERSHIP_ID
        )
        .maybeSingle();


    if (error) {
      throwSupabaseError(
        "Unable to inspect local ProjectMembership",
        error
      );
    }


    if (!membership) {

      const {
        error: admissionError,
      } =
        await admin.rpc(
          "add_project_member",
          {
            p_membership_id:
              MEMBERSHIP_ID,

            p_project_id:
              PROJECT_ID,

            p_person_id:
              PERSON_ID,

            p_effective_from:
              BASELINE_AT,

            p_effective_to:
              null,

            p_granted_by_person_id:
              PERSON_ID,

            p_membership_created_at:
              BASELINE_AT,

            p_role_assignment_id:
              MEMBER_ASSIGNMENT_ID,

            p_assigned_by_person_id:
              PERSON_ID,

            p_role_created_at:
              BASELINE_AT,

            p_correlation_id:
              ADMISSION_CORRELATION_ID,
          }
        );


      if (admissionError) {
        throwSupabaseError(
          "Unable to bootstrap local membership",
          admissionError
        );
      }

    } else {

      if (
        membership.project_id !==
          PROJECT_ID ||
        membership.person_id !==
          PERSON_ID ||
        membership.membership_status !==
          "ACTIVE"
      ) {
        throw new Error(
          "Existing deterministic local membership does not match the bootstrap contract."
        );
      }
    }
  }


  /*
   * ----------------------------------------------------------
   * Protected first appointments
   *
   * Initial Owner and Manager appointments still use the
   * protected-role transfer ledger.
   * ----------------------------------------------------------
   */

  async function ensureProtectedRole(
    role: ProtectedRole,
    assignmentId: string,
    transferId: string,
    correlationId: string
  ): Promise<void> {

    const {
      data,
      error,
    } =
      await admin
        .from(
          "project_role_assignments"
        )
        .select(`
          id,
          membership_id,
          role,
          effective_from,
          effective_to
        `)
        .eq(
          "project_id",
          PROJECT_ID
        )
        .eq(
          "role",
          role
        )
        .is(
          "effective_to",
          null
        );


    if (error) {
      throwSupabaseError(
        `Unable to inspect ${role}`,
        error
      );
    }


    if (
      data &&
      data.length > 1
    ) {
      throw new Error(
        `Multiple effective ${role} assignments exist in the local bootstrap project.`
      );
    }


    if (
      data &&
      data.length === 1
    ) {

      if (
        data[0].membership_id !==
        MEMBERSHIP_ID
      ) {
        throw new Error(
          `Existing ${role} belongs to an unexpected membership.`
        );
      }

      return;
    }


    const {
      error: transferError,
    } =
      await admin.rpc(
        "transfer_project_protected_role",
        {
          p_transfer_id:
            transferId,

          p_incoming_assignment_id:
            assignmentId,

          p_project_id:
            PROJECT_ID,

          p_incoming_membership_id:
            MEMBERSHIP_ID,

          p_role:
            role,

          p_effective_at:
            BASELINE_AT,

          p_authorised_by_person_id:
            PERSON_ID,

          p_reason:
            "Local development bootstrap",

          p_correlation_id:
            correlationId,

          p_created_at:
            BASELINE_AT,
        }
      );


    if (transferError) {
      throwSupabaseError(
        `Unable to bootstrap ${role}`,
        transferError
      );
    }
  }


  await ensureProtectedRole(
    "PROJECT_OWNER",
    OWNER_ASSIGNMENT_ID,
    OWNER_TRANSFER_ID,
    OWNER_CORRELATION_ID
  );


  await ensureProtectedRole(
    "PROJECT_MANAGER",
    MANAGER_ASSIGNMENT_ID,
    MANAGER_TRANSFER_ID,
    MANAGER_CORRELATION_ID
  );


  /*
   * ----------------------------------------------------------
   * Verify the exact working authentication bridge.
   * ----------------------------------------------------------
   */

  {
    const {
      data,
      error,
    } =
      await admin
        .from("users")
        .select(`
          id,
          person_id,
          auth_user_id,
          status
        `)
        .eq(
          "auth_user_id",
          authUser.id
        )
        .single();


    if (error) {
      throwSupabaseError(
        "Unable to verify Cadence auth-user mapping",
        error
      );
    }


    if (
      data.id !== USER_ID ||
      data.person_id !== PERSON_ID ||
      data.status !== "active"
    ) {
      throw new Error(
        "Local authentication mapping does not resolve to the expected Cadence identity."
      );
    }
  }


  /*
   * Verify browser-style Supabase Auth using the publishable key.
   */

  const browser =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );


  const {
    data: signIn,
    error: signInError,
  } =
    await browser.auth
      .signInWithPassword({
        email,
        password,
      });


  if (
    signInError ||
    !signIn.user ||
    !signIn.session
  ) {
    throwSupabaseError(
      "Local browser-style sign-in failed",
      signInError ?? {
        message:
          "Supabase returned no authenticated session.",
      }
    );
  }


  const {
    data: verified,
    error: verificationError,
  } =
    await browser.auth
      .getUser(
        signIn.session.access_token
      );


  if (
    verificationError ||
    !verified.user ||
    verified.user.id !== authUser.id
  ) {
    throwSupabaseError(
      "Local access-token verification failed",
      verificationError ?? {
        message:
          "Verified user did not match bootstrap user.",
      }
    );
  }


  await browser.auth.signOut();


  console.log(
    "Cadence local development bootstrap passed."
  );

  console.log(
    `Project: ${PROJECT_ID}`
  );

  console.log(
    "Auth -> Cadence User -> Person mapping verified."
  );
}


main().catch(
  (error: unknown) => {

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `Local development bootstrap failed: ${message}`
    );

    process.exitCode =
      1;
  }
);
