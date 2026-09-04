export const CADENCE_RUNTIME_CONFIG_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://cadence.example.invalid/schema/cadence.runtime.schema.json",
  type: "object",
  additionalProperties: false,
  required: [
    "configVersion",
    "application",
    "runtime",
    "supabase",
    "pilot",
    "worker",
    "retry",
  ],
  properties: {
    configVersion: { const: 1 },
    application: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "environment",
        "publicUrl",
        "apiBaseUrl",
        "requestBodyLimitBytes",
      ],
      properties: {
        name: { const: "cadence" },
        environment: { enum: ["local", "qa", "beta"] },
        publicUrl: { type: "string", minLength: 1 },
        apiBaseUrl: { type: "string" },
        requestBodyLimitBytes: {
          type: "integer",
          minimum: 1024,
          maximum: 1048576,
        },
      },
    },
    runtime: {
      type: "object",
      additionalProperties: false,
      required: ["provider"],
      properties: {
        provider: { enum: ["node", "cloudflare"] },
      },
    },
    supabase: {
      type: "object",
      additionalProperties: false,
      required: ["url", "projectRef", "publishableKey", "secretKeySecretRef"],
      properties: {
        url: { type: "string", minLength: 1 },
        projectRef: {
          anyOf: [
            { type: "string", pattern: "^[a-z0-9]+$" },
            { type: "null" },
          ],
        },
        publishableKey: { type: "string", minLength: 1 },
        secretKeySecretRef: { type: "string", minLength: 1 },
      },
    },
    pilot: {
      type: "object",
      additionalProperties: false,
      required: ["projectId", "safeTargetMarker"],
      properties: {
        projectId: {
          type: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        },
        safeTargetMarker: { type: "string", minLength: 1 },
      },
    },
    worker: {
      type: "object",
      additionalProperties: false,
      required: [
        "schedule",
        "maxRounds",
        "maxDeliveryAttempts",
        "maxMembershipExpiryAttempts",
        "softDeadlineSeconds",
      ],
      properties: {
        schedule: { type: "string", minLength: 1 },
        maxRounds: { type: "integer", minimum: 1, maximum: 100 },
        maxDeliveryAttempts: {
          type: "integer",
          minimum: 1,
          maximum: 200,
        },
        maxMembershipExpiryAttempts: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
        softDeadlineSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 30,
        },
      },
    },
    retry: {
      type: "object",
      additionalProperties: false,
      required: ["delaysSeconds"],
      properties: {
        delaysSeconds: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "integer", minimum: 1, maximum: 86400 },
        },
      },
    },
  },
} as const;
