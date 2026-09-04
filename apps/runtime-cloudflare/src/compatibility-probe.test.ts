import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/compatibility-probe.ts"),
  "utf8"
);

const wrangler = readFileSync(
  resolve(process.cwd(), "wrangler.probe.jsonc"),
  "utf8"
);

test("probe routes HTTP through Cloudflare Node integration", () => {
  assert.match(source, /httpServerHandler/);
  assert.match(source, /\.\.\/\.\.\/api\/src\/server/);
});

test("probe exposes a scheduled handler with platform retry disabled", () => {
  assert.match(source, /scheduled\s*\(/);
  assert.match(source, /controller\.noRetry\(\)/);
});

test("probe uses Workers Static Assets and a post-2026-08-04 compatibility date", () => {
  assert.match(wrangler, /"assets"/);
  assert.match(wrangler, /"directory"\s*:\s*"\.\.\/web\/dist"/);
  assert.match(wrangler, /"compatibility_date"\s*:\s*"2026-09-04"/);
  assert.match(wrangler, /"compatibility_flags"\s*:\s*\[\s*"nodejs_compat"\s*\]/);
});
