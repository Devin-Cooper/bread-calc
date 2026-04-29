import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// Strips fields that are deliberately nondeterministic. Currently only
// `_meta.timestamp_iso` (envelope's nondeterministic field).
export function stripNondeterministic(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripNondeterministic);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "timestamp_iso") continue;
      if (k === "tool_version") { out[k] = "<TOOL_VERSION>"; continue; }
      out[k] = stripNondeterministic(v);
    }
    return out;
  }
  return obj;
}

export function assertContract(name: string, actual: unknown): void {
  const path = join(FIXTURES_DIR, `${name}.golden.json`);
  const stripped = stripNondeterministic(actual);
  if (process.env["UPDATE_CONTRACT"] === "1") {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(stripped, null, 2) + "\n");
    return;
  }
  if (!existsSync(path)) {
    throw new Error(`contract fixture missing: ${path}. Run 'npm run update-contract' to create.`);
  }
  const golden = JSON.parse(readFileSync(path, "utf8"));
  expect(stripped).toEqual(golden);
}
