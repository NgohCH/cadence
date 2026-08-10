import express from "express";
import { createClient } from "@supabase/supabase-js";

import { success } from "./bootstrap/api-response";

import { SupabaseAuthProvider } from "./infrastructure/auth/supabase-auth-provider";
import { SupabaseIdentityRepository } from "./infrastructure/database/supabase-identity.repository";

import { createAuthenticateMiddleware } from "./middleware/authenticate";
import { requestTraceMiddleware } from "./middleware/request-trace.middleware";

import { IdentityService } from "./modules/identity/identity.service";
import { createIdentityRouter } from "./modules/identity/identity.routes";

const app = express();

const port = process.env.PORT
  ? Number(process.env.PORT)
  : 3000;

/*
 * Environment configuration
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (
  !supabaseUrl ||
  !supabasePublishableKey ||
  !supabaseSecretKey
) {
  throw new Error(
    "Missing required Supabase environment variables."
  );
}

/*
 * Infrastructure
 */
const authProvider =
  new SupabaseAuthProvider(
    supabaseUrl,
    supabasePublishableKey
  );

const databaseClient = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

const identityRepository =
  new SupabaseIdentityRepository(
    databaseClient
  );

/*
 * Application services
 */
const identityService =
  new IdentityService(
    identityRepository
  );

const authenticate =
  createAuthenticateMiddleware(
    authProvider,
    identityService
  );

/*
 * Global middleware
 */
app.use(express.json());
app.use(requestTraceMiddleware);

/*
 * Public routes
 */
app.get("/health", (_req, res) => {
  res.status(200).json(
    success(
      {
        status: "ok"
      },
      {
        correlation_id:
          res.locals.correlationId,
        request_id:
          res.locals.requestId,
        next_cursor: null
      }
    )
  );
});

/*
 * Protected routes
 */
app.use(
  "/api/v1",
  authenticate,
  createIdentityRouter()
);

/*
 * Start server
 */
app.listen(port, () => {
  console.log(
    `Cadence API running on http://localhost:${port}`
  );
});