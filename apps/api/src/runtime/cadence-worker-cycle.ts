import { randomUUID } from "node:crypto";

import type { CadenceRuntimeConfig } from "../bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../bootstrap/cadence-release";
import type { MembershipExpiryProcessingResult } from "../modules/project-membership/project-membership-expiry.processor";

export type WorkerCycleOutcome = "SUCCESS" | "DEGRADED" | "FAILED";

export interface CadenceWorkerCycleResult {
  runId: string;
  runtime: "node" | "cloudflare";
  environment: "local" | "qa" | "beta";
  release: CadenceReleaseIdentity;
  startedAt: string;
  completedAt: string;
  outcome: WorkerCycleOutcome;

  membershipExpiry: {
    finalisedCount: number;
    conflictCount: number;
    failureCount: number;
    remainingDueDetected: boolean;
  };

  audit: {
    processedCount: number;
    failureCount: number;
  };

  teamAgent: {
    processedCount: number;
    failureCount: number;
  };

  maxRoundsReached: boolean;
  maxDeliveryAttemptsReached: boolean;
  maxMembershipExpiryAttemptsReached: boolean;
  softDeadlineReached: boolean;
  remainingWorkDetected: boolean;

  failures: readonly {
    job: "runtime" | "membership-expiry" | "audit" | "team-agent";
    code: string;
  }[];
}

export interface CadenceWorkerCycleServices {
  processMembershipExpiry(
    maxMemberships: number
  ): Promise<MembershipExpiryProcessingResult>;

  processAuditNext(): Promise<boolean>;
  processTeamAgentNext(): Promise<boolean>;
}

const WORKER_FAILURE_CODES = {
  runtime: "RUNTIME_ESTABLISHMENT_FAILED",
  membershipExpiry: "MEMBERSHIP_EXPIRY_FAILED",
  audit: "AUDIT_DELIVERY_FAILED",
  teamAgent: "TEAM_AGENT_DELIVERY_FAILED",
} as const;

export async function runCadenceWorkerCycle(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  runtime: "node" | "cloudflare";
  servicesFactory:
    () => CadenceWorkerCycleServices | Promise<CadenceWorkerCycleServices>;
  clock?: () => Date;
  generateRunId?: () => string;
}): Promise<CadenceWorkerCycleResult> {
  const clock = input.clock ?? (() => new Date());
  const generateRunId = input.generateRunId ?? (() => randomUUID());
  const startedAt = clock().toISOString();
  const runId = generateRunId();
  const failures: Array<{
    job: "runtime" | "membership-expiry" | "audit" | "team-agent";
    code: string;
  }> = [];

  let services: CadenceWorkerCycleServices;
  try {
    services = await input.servicesFactory();
  } catch {
    return createResult({
      input,
      runId,
      startedAt,
      completedAt: clock().toISOString(),
      outcome: "FAILED",
      failures: [{
        job: "runtime",
        code: WORKER_FAILURE_CODES.runtime,
      }],
    });
  }

  let finalisedCount = 0;
  let conflictCount = 0;
  let expiryFailureCount = 0;
  let remainingDueDetected = false;

  try {
    const expiry = await services.processMembershipExpiry(
      input.config.worker.maxMembershipExpiryAttempts
    );
    finalisedCount = expiry.finalised.length;
    conflictCount = expiry.conflicts.length;
    remainingDueDetected = expiry.remainingDue;
  } catch {
    expiryFailureCount = 1;
    failures.push({
      job: "membership-expiry",
      code: WORKER_FAILURE_CODES.membershipExpiry,
    });
  }

  let auditProcessedCount = 0;
  let auditFailureCount = 0;
  let teamAgentProcessedCount = 0;
  let teamAgentFailureCount = 0;
  let deliveryAttempts = 0;
  let completedRounds = 0;
  let eventWorkObserved = false;
  let maxRoundsReached = false;
  let maxDeliveryAttemptsReached = false;
  let softDeadlineReached = false;
  let cleanEventExhaustion = false;

  const deadline = Date.parse(startedAt) +
    input.config.worker.softDeadlineSeconds * 1000;

  const isDeadlineReached = (): boolean => {
    if (clock().getTime() >= deadline) {
      softDeadlineReached = true;
      return true;
    }
    return false;
  };

  while (completedRounds < input.config.worker.maxRounds) {
    if (deliveryAttempts >= input.config.worker.maxDeliveryAttempts) {
      maxDeliveryAttemptsReached = true;
      break;
    }

    if (isDeadlineReached()) {
      break;
    }

    completedRounds += 1;
    let auditResult: boolean | undefined;
    let teamAgentResult: boolean | undefined;
    let roundFailed = false;

    deliveryAttempts += 1;
    try {
      auditResult = await services.processAuditNext();
      if (auditResult) {
        auditProcessedCount += 1;
        eventWorkObserved = true;
      }
    } catch {
      auditFailureCount += 1;
      roundFailed = true;
      failures.push({
        job: "audit",
        code: WORKER_FAILURE_CODES.audit,
      });
    }

    if (deliveryAttempts < input.config.worker.maxDeliveryAttempts && !isDeadlineReached()) {
      deliveryAttempts += 1;
      try {
        teamAgentResult = await services.processTeamAgentNext();
        if (teamAgentResult) {
          teamAgentProcessedCount += 1;
          eventWorkObserved = true;
        }
      } catch {
        teamAgentFailureCount += 1;
        roundFailed = true;
        failures.push({
          job: "team-agent",
          code: WORKER_FAILURE_CODES.teamAgent,
        });
      }
    }

    if (auditResult === false && teamAgentResult === false && !roundFailed && failures.length === 0) {
      cleanEventExhaustion = true;
      break;
    }

    if (completedRounds >= input.config.worker.maxRounds) {
      maxRoundsReached = eventWorkObserved;
      break;
    }

    if (deliveryAttempts >= input.config.worker.maxDeliveryAttempts) {
      maxDeliveryAttemptsReached = true;
      break;
    }
  }

  const remainingWorkDetected =
    remainingDueDetected || !cleanEventExhaustion;

  const outcome: WorkerCycleOutcome =
    failures.length > 0 || conflictCount > 0
      ? "DEGRADED"
      : "SUCCESS";

  return createResult({
    input,
    runId,
    startedAt,
    completedAt: clock().toISOString(),
    outcome,
    failures,
    membershipExpiry: {
      finalisedCount,
      conflictCount,
      failureCount: expiryFailureCount,
      remainingDueDetected,
    },
    audit: {
      processedCount: auditProcessedCount,
      failureCount: auditFailureCount,
    },
    teamAgent: {
      processedCount: teamAgentProcessedCount,
      failureCount: teamAgentFailureCount,
    },
    maxRoundsReached,
    maxDeliveryAttemptsReached,
    maxMembershipExpiryAttemptsReached: remainingDueDetected,
    softDeadlineReached,
    remainingWorkDetected,
  });
}

function createResult(input: {
  input: {
    config: CadenceRuntimeConfig;
    release: CadenceReleaseIdentity;
    runtime: "node" | "cloudflare";
  };
  runId: string;
  startedAt: string;
  completedAt: string;
  outcome: WorkerCycleOutcome;
  failures: readonly {
    job: "runtime" | "membership-expiry" | "audit" | "team-agent";
    code: string;
  }[];
  membershipExpiry?: {
    finalisedCount: number;
    conflictCount: number;
    failureCount: number;
    remainingDueDetected: boolean;
  };
  audit?: {
    processedCount: number;
    failureCount: number;
  };
  teamAgent?: {
    processedCount: number;
    failureCount: number;
  };
  maxRoundsReached?: boolean;
  maxDeliveryAttemptsReached?: boolean;
  maxMembershipExpiryAttemptsReached?: boolean;
  softDeadlineReached?: boolean;
  remainingWorkDetected?: boolean;
}): CadenceWorkerCycleResult {
  return {
    runId: input.runId,
    runtime: input.input.runtime,
    environment: input.input.config.application.environment,
    release: input.input.release,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    outcome: input.outcome,
    membershipExpiry: input.membershipExpiry ?? {
      finalisedCount: 0,
      conflictCount: 0,
      failureCount: 0,
      remainingDueDetected: false,
    },
    audit: input.audit ?? { processedCount: 0, failureCount: 0 },
    teamAgent: input.teamAgent ?? { processedCount: 0, failureCount: 0 },
    maxRoundsReached: input.maxRoundsReached ?? false,
    maxDeliveryAttemptsReached: input.maxDeliveryAttemptsReached ?? false,
    maxMembershipExpiryAttemptsReached: input.maxMembershipExpiryAttemptsReached ?? false,
    softDeadlineReached: input.softDeadlineReached ?? false,
    remainingWorkDetected: input.remainingWorkDetected ?? false,
    failures: input.failures,
  };
}
