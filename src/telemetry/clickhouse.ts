// Action telemetry mirror. Primary detection reads Guild's session audit trail
// via CLI; this is (a) the local-dev fallback so you can build without Guild up,
// and (b) an optional ClickHouse-backed dashboard.
//
// Default impl is an in-process file log so everything runs with zero infra.
// Swap the bodies for ClickHouse inserts/queries if you want the dashboard.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LOG = join(here, "../../attack/actions.json");

export type ActionRecord = {
  agent: string;
  sessionId: string;
  tool: string;
  input: unknown;
  ts: number;
};

export async function recordAction(a: ActionRecord): Promise<void> {
  const all: ActionRecord[] = existsSync(LOG)
    ? JSON.parse(readFileSync(LOG, "utf8"))
    : [];
  all.push(a);
  writeFileSync(LOG, JSON.stringify(all, null, 2));
  // Optional: also INSERT INTO clickhouse agent_actions ... for the dashboard.
}

export async function readActions(agent: string) {
  if (!existsSync(LOG)) return [];
  const all: ActionRecord[] = JSON.parse(readFileSync(LOG, "utf8"));
  return all
    .filter((a) => a.agent === agent)
    .map((a) => ({ tool: a.tool, input: a.input, ts: a.ts }));
}
