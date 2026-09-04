import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  loadCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";

export interface BetaRuntimeVerification {
  outcome: "PASS";
  requireEmptyApplicationData: boolean;
  criticalTablesVerified: readonly string[];
  subscriptionCount: number;
}

export interface BetaRuntimeVerificationSources {
  criticalTableAvailable(table: string): Promise<boolean>;
  tableCount(table: string): Promise<number>;
  subscriptionCount(): Promise<number>;
  anonymousRowVisible(table: string): Promise<boolean>;
}

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
] as const;

const applicationDataTables = [
  "persons",
  "project_memberships",
  "project_role_assignments",
  "project_role_transfers",
  "domain_events",
] as const;

const sensitiveTables = [
  "persons",
  "authentication_identities",
  "project_role_assignments",
] as const;

export async function verifyBetaRuntime(input: {
  config: CadenceRuntimeConfig;
  secretKey: string;
  requireEmptyApplicationData: boolean;
  sources: BetaRuntimeVerificationSources;
}): Promise<BetaRuntimeVerification> {
  const config = validateCadenceRuntimeConfig(input.config);
  if (
    config.application.environment !== "beta" ||
    config.supabase.projectRef === null ||
    config.runtime.provider !== "cloudflare"
  ) {
    throw new Error("Beta verification requires the canonical Beta runtime target.");
  }
  if (!input.secretKey.trim()) {
    throw new Error("Beta verification requires the configured Supabase secret.");
  }

  for (const table of criticalTables) {
    if (!(await input.sources.criticalTableAvailable(table))) {
      throw new Error(`Critical Beta table unavailable: ${table}`);
    }
  }

  if (input.requireEmptyApplicationData) {
    for (const table of applicationDataTables) {
      const count = await input.sources.tableCount(table);
      if (count !== 0) {
        throw new Error(`Fresh Beta invariant failed: ${table} contains ${count} row(s).`);
      }
    }
  }

  const subscriptionCount = await input.sources.subscriptionCount();
  if (subscriptionCount === 0) {
    throw new Error("Beta has no domain-event subscriptions.");
  }

  for (const table of sensitiveTables) {
    if (await input.sources.anonymousRowVisible(table)) {
      throw new Error(`Anonymous Beta access exposed ${table}.`);
    }
  }

  return {
    outcome: "PASS",
    requireEmptyApplicationData: input.requireEmptyApplicationData,
    criticalTablesVerified: criticalTables,
    subscriptionCount,
  };
}

function sourcesFromClients(
  service: SupabaseClient,
  anonymous: SupabaseClient,
): BetaRuntimeVerificationSources {
  return {
    criticalTableAvailable: async (table) => {
      const { error } = await service.from(table).select("*", {
        head: true,
        count: "exact",
      });
      return !error;
    },
    tableCount: async (table) => {
      const { count, error } = await service.from(table).select("*", {
        head: true,
        count: "exact",
      });
      if (error) throw new Error(`Unable to inspect Beta table ${table}: ${error.message}`);
      return count ?? 0;
    },
    subscriptionCount: async () => {
      const { count, error } = await service
        .from("domain_event_subscriptions")
        .select("*", { head: true, count: "exact" });
      if (error) throw new Error(`Unable to inspect domain-event subscriptions: ${error.message}`);
      return count ?? 0;
    },
    anonymousRowVisible: async (table) => {
      const { data } = await anonymous.from(table).select("*").limit(1);
      return Boolean(data && data.length > 0);
    },
  };
}

async function main(): Promise<void> {
  const configPath = resolveCadenceConfigPath({
    argv: process.argv.slice(2),
    environment: process.env,
  });
  const config = loadCadenceRuntimeConfig(configPath);
  const { supabaseSecretKey } = resolveCadenceSecrets(config, process.env);
  const service = createClient(config.supabase.url, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonymous = createClient(config.supabase.url, config.supabase.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await verifyBetaRuntime({
    config,
    secretKey: supabaseSecretKey,
    requireEmptyApplicationData: !process.argv.includes("--deployed"),
    sources: sourcesFromClients(service, anonymous),
  });
  console.log(`Cadence Beta runtime verification passed (${result.requireEmptyApplicationData ? "fresh" : "deployed"}).`);
  console.log(`Critical tables verified: ${result.criticalTablesVerified.length}`);
  console.log(`Domain-event subscriptions present: ${result.subscriptionCount}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
