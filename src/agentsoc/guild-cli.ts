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

// Pull the recent action trail for a session.
// CONFIRMED against guild v0.12.3 with a REAL session: the action trail lives in
// `session events` (NOT `session get`, which is only metadata). Events come back
// as { items: [...] }. Confirmed event types: user_message,
// agent_notification_progress, agent_notification_message, credentials_request.
// `credentials_request` is the key one — it's the agent reaching for an
// integration's credentials, i.e. the runtime-deny interception point.
export async function getSessionActions(sessionId: string): Promise<SessionAction[]> {
  try {
    const out = await guild(["--mode", "json", "session", "events", sessionId]);
    const parsed: unknown = JSON.parse(out);
    const items = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : extractSteps(parsed);
    const actions: SessionAction[] = [];
    for (const ev of items) {
      const a = mapGuildEvent(ev);
      if (a) actions.push(a);
    }
    // Fall back to the generic normalizer if the event mapping found nothing but
    // the payload still looks like a tool trace in some other shape.
    return actions.length > 0 ? actions : normalizeSessionActions(out);
  } catch {
    // If the CLI path errors (offline/local dev), caller falls back to the
    // ClickHouse / file mirror. Detection keeps working offline.
    return [];
  }
}

// Map a single Guild session event into a SessionAction (a tool-ish action), or
// null for chatter (user_message, streaming notifications) AgentSOC ignores.
function mapGuildEvent(ev: unknown): SessionAction | null {
  if (!isRecord(ev)) return null;
  const type = firstString(ev.type, ev.event_type, ev.kind);
  const ts = firstNumber(ev.created_at, ev.ts, ev.timestamp);

  // A credential request = the agent reaching for an integration's access. We
  // surface it as the guild_credentials_request "tool" so a policy that scopes
  // which integrations an agent may touch can flag/deny it.
  if (type === "credentials_request") {
    const integ = isRecord(ev.integration)
      ? firstString(ev.integration.full_name, ev.integration.name, ev.integration.service)
      : firstString(ev.integration);
    return {
      tool: "guild_credentials_request",
      input: { integration: integ, target_account: ev.target_account, is_fulfilled: ev.is_fulfilled },
      ts,
    };
  }

  // Tool-call events. The exact type name isn't confirmed yet (our test session
  // stalled at credentials_request — no GitHub connected, so no tool ran). Stay
  // tolerant: match likely type names and pull the tool name/input from the event
  // or its content. VENUE TODO: once a real tool runs, confirm the type + shape.
  if (type && /tool[_-]?call|tool[_-]?use|agent[_-]?tool|function[_-]?call/i.test(type)) {
    const content = ev.content;
    if (isRecord(content)) {
      const tool = firstString(content.name, content.tool, content.tool_name);
      if (tool) return { tool, input: firstDefined(content.input, content.arguments, content.args), ts };
    }
    const tool = firstString(ev.tool, ev.tool_name, ev.name);
    if (tool) return { tool, input: firstDefined(ev.input, ev.arguments, ev.args), ts };
  }

  return null;
}

export async function listSessions(): Promise<string[]> {
  try {
    const out = await guild(["--mode", "json", "session", "list"]);
    const parsed: unknown = JSON.parse(out);
    // Confirmed shape: { items: [...], pagination: {...} }. Tolerate older guesses.
    const list = isRecord(parsed)
      ? (parsed.items ?? parsed.sessions ?? [])
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

// CONTAINMENT — stop the compromised agent.
//
// VERIFIED against guild v0.12.3 with a live installed agent:
//   • `agent unpublish` FAILS for an installed agent ("used in N workspaces") —
//     so it is NOT a usable kill switch for a running agent.
//   • The real agent-level kill is `workspace agent remove <agent> --workspace <id>`
//     (verified: removes it so it stops serving; reversible via `workspace agent add`).
//   • The real-time kill for an in-flight run is `session interrupt <session-id>`
//     (see interruptSession below) — the strongest demo beat.
//   • There is no `agent disable`/`pause`.
//
// disableAgent does the agent-level kill (workspace remove). Set GUILD_WORKSPACE_ID
// so it knows which workspace; without it, falls back to unpublish (only works if
// the agent isn't installed anywhere). GUILD_DISABLE_CMD still overrides everything.
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

  // Path 2: verified-real containment. Remove the agent from its workspace (the
  // only thing that actually stops an installed/running agent). Falls back to
  // unpublish when no workspace is configured (works only if not installed).
  const workspaceId = process.env.GUILD_WORKSPACE_ID?.trim();
  const args = workspaceId
    ? ["workspace", "agent", "remove", agentId, "--workspace", workspaceId]
    : ["agent", "unpublish", agentId];
  try {
    await guild(args);
    console.log(`[AgentSOC] containment: ran \`guild ${args.join(" ")}\``);
  } catch (e: unknown) {
    if (isErrno(e) && e.code === "ENOENT") {
      console.log(`[AgentSOC] containment: guild CLI not found — dry-run disable of ${agentId}`);
      return;
    }
    throw new Error(`Containment failed: \`guild ${args.join(" ")}\` — ${String(e)}`);
  }
}

// Inverse of disableAgent's workspace-remove path: re-add the agent to its
// workspace. Used to restore demo/test state after a containment run so the
// pipeline proof leaves the workspace exactly as it found it. No-op (dry-run)
// when no workspace is configured or the CLI is absent.
export async function restoreAgent(agentId: string): Promise<void> {
  const workspaceId = process.env.GUILD_WORKSPACE_ID?.trim();
  if (!workspaceId) {
    console.log(`[AgentSOC] restore: no GUILD_WORKSPACE_ID — skipping re-add of ${agentId}`);
    return;
  }
  const args = ["workspace", "agent", "add", agentId, "--workspace", workspaceId];
  try {
    await guild(args);
    console.log(`[AgentSOC] restore: ran \`guild ${args.join(" ")}\``);
  } catch (e: unknown) {
    if (isErrno(e) && e.code === "ENOENT") {
      console.log(`[AgentSOC] restore: guild CLI not found — dry-run re-add of ${agentId}`);
      return;
    }
    throw new Error(`Restore failed: \`guild ${args.join(" ")}\` — ${String(e)}`);
  }
}

// Real-time containment: interrupt an in-flight session as it happens — the
// strongest demo beat. Needs the live session id (from listSessions / the event
// stream). VERIFIED command: `guild session interrupt <session-id>`.
export async function interruptSession(sessionId: string): Promise<void> {
  try {
    await guild(["session", "interrupt", sessionId]);
    console.log(`[AgentSOC] containment: ran \`guild session interrupt ${sessionId}\``);
  } catch (e: unknown) {
    if (isErrno(e) && e.code === "ENOENT") {
      console.log(`[AgentSOC] containment: guild CLI not found — dry-run interrupt of ${sessionId}`);
      return;
    }
    throw new Error(`Session interrupt failed for ${sessionId}: ${String(e)}`);
  }
}

function isErrno(e: unknown): e is NodeJS.ErrnoException {
  return isRecord(e) && "code" in e;
}
