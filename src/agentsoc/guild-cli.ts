// Thin wrapper around the Guild CLI. Audit logs are NOT exposed as a REST/SDK
// endpoint, but ARE queryable via the CLI. Subcommands below CONFIRMED against
// `guild v0.12.3` (`guild --help` / `guild session --help` / `guild agent --help`):
//   guild session list | get <id> | events <id> | interrupt <id>
//   guild agent unpublish <id>          (closest real "kill" — no agent disable/pause)
//   guild credentials policy create/update/delete   (the runtime-deny lever, A0)
// JSON output is the GLOBAL flag `--mode json` (NOT a per-command `--json`).
//
// VENUE TODO: capture the real `session get`/`events` JSON shape (needs auth +
// a live session) to confirm the normalizer mapping, and confirm whether
// `agent unpublish` stops an in-flight run or if `session interrupt <session-id>`
// is the cleaner kill. The normalizer + the CLI call sites isolate every
// remaining assumption to a single edit point.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

async function guild(args: string[]): Promise<string> {
  const { stdout } = await run("guild", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export type SessionAction = {
  tool: string;
  input: unknown;
  ts?: number;
};

// ---------------------------------------------------------------------------
// PURE NORMALIZER
// ---------------------------------------------------------------------------
// Turn whatever `guild session get` hands us into SessionAction[]. The real
// Guild output shape is UNKNOWN until the venue, so this is deliberately
// permissive: it accepts several plausible top-level containers and several
// plausible per-step item shapes, skips anything that isn't a tool call, and
// NEVER throws — bad input yields []. Each shape assumption is flagged with a
// VENUE TODO so confirming the real shape is a quick edit (often a no-op,
// because the real shape is probably already one of these).
export function normalizeSessionActions(raw: unknown): SessionAction[] {
  try {
    // The CLI might hand us a JSON string instead of parsed data.
    let data: unknown = raw;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return [];
      }
    }

    const steps = extractSteps(data);
    const out: SessionAction[] = [];
    for (const step of steps) {
      const action = normalizeStep(step);
      if (action) out.push(action);
    }
    return out;
  } catch {
    // Belt-and-suspenders: the normalizer must never throw on bad input.
    return [];
  }
}

// Find the array of steps inside whatever container Guild used.
// VENUE TODO: confirm the real top-level key. Candidates seen across agent
// audit formats: {steps}, {actions}, {events}, {trace}, or a bare top-level
// array. We also peek into a nested {session:{...}} / {data:{...}} envelope.
function extractSteps(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];

  // Unwrap a common envelope shape ({ session: {...} } / { data: {...} }).
  const inner =
    (isRecord(data.session) && data.session) ||
    (isRecord(data.data) && data.data) ||
    data;

  const container =
    (inner as Record<string, unknown>).steps ??
    (inner as Record<string, unknown>).actions ??
    (inner as Record<string, unknown>).events ??
    (inner as Record<string, unknown>).trace ??
    // also tolerate the keys at the very top level if they weren't nested.
    data.steps ??
    data.actions ??
    data.events ??
    data.trace;

  return Array.isArray(container) ? container : [];
}

// Normalize a single step into a SessionAction, or null if it isn't a tool call.
// VENUE TODO: confirm the real per-step item shape. We handle:
//   {tool, input, ts}                          (flat)
//   {tool_call: {name, input}}                 (nested tool_call)
//   {type: 'tool_use', name, input}            (Anthropic-style block)
//   {name, arguments}                          (OpenAI function-call style)
//   {tool_name, ...} / {function: {name,...}}  (extra tolerant variants)
function normalizeStep(step: unknown): SessionAction | null {
  if (!isRecord(step)) return null;

  // Pull a timestamp from any of the plausible field names.
  const ts = firstNumber(step.ts, step.timestamp, step.time, step.created_at);

  // 1) Nested tool_call: { tool_call: { name, input/arguments } }
  if (isRecord(step.tool_call)) {
    const tc = step.tool_call;
    const tool = firstString(tc.name, tc.tool, tc.tool_name);
    if (!tool) return null;
    return { tool, input: firstDefined(tc.input, tc.arguments, tc.args), ts };
  }

  // 2) OpenAI function-call style: { function: { name, arguments } }
  if (isRecord(step.function)) {
    const fn = step.function;
    const tool = firstString(fn.name, fn.tool, fn.tool_name);
    if (!tool) return null;
    return { tool, input: firstDefined(fn.input, fn.arguments, fn.args), ts };
  }

  // 3) Typed block: only treat as a tool call when the type says so. This is
  // how we skip non-tool steps (text/thinking/message) in a typed trace.
  const type = firstString(step.type, step.kind, step.event);
  if (type !== undefined) {
    const isToolType = /tool[_-]?use|tool[_-]?call|tool|function[_-]?call/i.test(
      type,
    );
    if (!isToolType) return null;
  }

  // 4) Flat shapes: {tool|name|tool_name, input|arguments|args}
  const tool = firstString(step.tool, step.tool_name, step.name);
  if (!tool) return null;
  return {
    tool,
    input: firstDefined(step.input, step.arguments, step.args, step.parameters),
    ts,
  };
}

// --- tiny typed helpers (no `any` across the boundary) ---------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

function firstNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Date.parse(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function firstDefined(...vals: unknown[]): unknown {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

// ---------------------------------------------------------------------------
// CLI CALL SITES
// ---------------------------------------------------------------------------

// Pull the recent action trail for an agent's session.
// argv CONFIRMED against guild v0.12.3: `--mode json` is the global JSON flag and
// must precede the subcommand. The only thing left to confirm at the venue is the
// JSON body shape — and the normalizer already tolerates the likely candidates.
export async function getSessionActions(sessionId: string): Promise<SessionAction[]> {
  try {
    const out = await guild(["--mode", "json", "session", "get", sessionId]);
    return normalizeSessionActions(out);
  } catch {
    // If the CLI path isn't wired yet (or errors), the caller falls back to the
    // ClickHouse / file mirror. Detection keeps working offline.
    return [];
  }
}

export async function listSessions(): Promise<string[]> {
  try {
    const out = await guild(["--mode", "json", "session", "list"]);
    const parsed: unknown = JSON.parse(out);
    const list = isRecord(parsed)
      ? parsed.sessions ?? []
      : Array.isArray(parsed)
        ? parsed
        : [];
    if (!Array.isArray(list)) return [];
    return list
      .map((s) => (isRecord(s) ? firstString(s.id) : typeof s === "string" ? s : undefined))
      .filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

// CONTAINMENT — the guaranteed fallback path. Stop the compromised agent.
//
// Config-driven: set GUILD_DISABLE_CMD to the exact, confirmed command once you
// know it at the venue, e.g.
//   GUILD_DISABLE_CMD="guild agent unpublish {agentId}"
// The first token is the executable and {agentId} is substituted with the id.
// If unset, we fall back to a best-effort loop over the documented candidates.
//
// CONFIRMED against guild v0.12.3: there is NO `agent disable`/`pause`. The verb
// closest to "kill the agent" is `agent unpublish <id>` (delists it so it stops
// serving). For stopping an IN-FLIGHT hijacked run, `session interrupt <session-id>`
// is likely cleaner — but that needs the session id, not the agent id, so it's a
// caller-level change (track the active session) rather than a swap here.
// VENUE TODO: confirm whether `agent unpublish` halts a running session or only
// delists; if only delists, pivot containment to `session interrupt` (needs the
// live session id) or `trigger deactivate <trigger-id>`.
export async function disableAgent(agentId: string): Promise<void> {
  // Path 1: explicit operator-supplied command wins (the venue 1-line swap).
  const override = process.env.GUILD_DISABLE_CMD?.trim();
  if (override) {
    const tokens = override
      .split(/\s+/)
      .map((t) => t.replace(/\{agentId\}/g, agentId));
    const [bin, ...args] = tokens;
    if (!bin) {
      throw new Error("GUILD_DISABLE_CMD is set but empty after parsing.");
    }
    try {
      await run(bin, args, { maxBuffer: 10 * 1024 * 1024 });
      console.log(`[AgentSOC] containment: ran \`${tokens.join(" ")}\` (GUILD_DISABLE_CMD)`);
      return;
    } catch (e: unknown) {
      if (isErrno(e) && e.code === "ENOENT") {
        console.log(
          `[AgentSOC] containment: \`${bin}\` not found — dry-run disable of ${agentId} (GUILD_DISABLE_CMD)`,
        );
        return;
      }
      throw new Error(
        `GUILD_DISABLE_CMD failed for agent ${agentId}: \`${tokens.join(" ")}\` — ${String(e)}`,
      );
    }
  }

  // Path 2: best-effort over the CONFIRMED-real candidate (v0.12.3). `agent
  // unpublish` is the only documented agent-scoped off-switch; `agent disable`/
  // `pause` do not exist and were removed.
  const attempts: string[][] = [["agent", "unpublish", agentId]];
  let lastErr: unknown;
  for (const args of attempts) {
    try {
      await guild(args);
      console.log(`[AgentSOC] containment: ran \`guild ${args.join(" ")}\``);
      return;
    } catch (e: unknown) {
      // ENOENT = guild CLI not installed (offline/local dev) — treat as dry-run.
      if (isErrno(e) && e.code === "ENOENT") {
        console.log(`[AgentSOC] containment: guild CLI not found — dry-run disable of ${agentId}`);
        return;
      }
      lastErr = e;
    }
  }
  throw new Error(
    `Could not disable agent via CLI — set GUILD_DISABLE_CMD or fix disableAgent() with the confirmed subcommand. Last error: ${String(lastErr)}`,
  );
}

function isErrno(e: unknown): e is NodeJS.ErrnoException {
  return isRecord(e) && "code" in e;
}
