import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { CADENCE_RUNTIME_CONFIG_SCHEMA } from "../src/bootstrap/cadence-config-schema";

const schemaPath = resolve(__dirname, "../../../config/cadence.runtime.schema.json");

writeFileSync(schemaPath, `${JSON.stringify(CADENCE_RUNTIME_CONFIG_SCHEMA, null, 2)}\n`, "utf8");
console.log(`Wrote ${schemaPath}`);
