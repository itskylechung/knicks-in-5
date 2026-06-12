// Thin wrapper around the Guild CLI. Per the docs research, audit logs are NOT
// exposed as a REST/SDK endpoint, but ARE queryable via:
//   guild session list
//   guild session get <id>
//   guild credentials endpoint list
// and agents/triggers are manageable via CLI. This is our real telemetry +
// containment surface.
//
// VENUE TODO: confirm exact subcommands/flags and JSON output shape. The parse
// functions below isolate every assumption so you only fix them in one place.
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

// Pull the recent action trail for an agent's session.
// VENUE TODO: adjust to the real `guild session get` output. If the CLI does not
// emit JSON, add `--json` or parse the human format here.
export async function getSessionActions(sessionId: string): Promise<SessionAction[]> {
  try {
    const out = await guild(["session", "get", sessionId, "--json"]);
    const parsed = JSON.parse(out);
    // Expected-ish shape; remap once you see the real thing.
    const steps = parsed.steps ?? parsed.actions ?? [];
    return steps
      .filter((s: any) => s.tool_call || s.tool || s.type === "tool_use")
      .map((s: any) => ({
        tool: s.tool ?? s.tool_call?.name ?? s.name,
        input: s.input ?? s.tool_call?.input ?? s.arguments,
        ts: s.ts,
      }));
  } catch (e) {
    // If the CLI path isn't wired yet, the caller falls back to ClickHouse.
    return [];
  }
}

export async function listSessions(): Promise<string[]> {
  try {
    const out = await guild(["session", "list", "--json"]);
    const parsed = JSON.parse(out);
    return (parsed.sessions ?? parsed ?? []).map((s: any) => s.id ?? s);
  } catch {
    return [];
  }
}

// CONTAINMENT — the guaranteed fallback path. Stop the compromised agent.
// The documented Guild CLI verb closest to "kill the agent" is `agent unpublish`
// (removes it from the workspace/hub so it stops serving). There is no `agent
// disable`/`pause` in the public command list, so unpublish is the real attempt;
// the others are kept as fallbacks in case your workspace exposes more.
// VENUE TODO: confirm `guild agent unpublish` actually stops a running agent —
// if it only delists, "containment" may instead be deleting its trigger/schedule.
export async function disableAgent(agentId: string): Promise<void> {
  const attempts: string[][] = [
    ["agent", "unpublish", agentId],
    ["agent", "disable", agentId],
    ["agent", "pause", agentId],
  ];
  let lastErr: unknown;
  for (const args of attempts) {
    try {
      await guild(args);
      console.log(`[AgentSOC] containment: ran \`guild ${args.join(" ")}\``);
      return;
    } catch (e: any) {
      // ENOENT = guild CLI not installed (offline/local dev) — treat as dry-run.
      if (e?.code === "ENOENT") {
        console.log(`[AgentSOC] containment: guild CLI not found — dry-run disable of ${agentId}`);
        return;
      }
      lastErr = e;
    }
  }
  throw new Error(
    `Could not disable agent via CLI — fix disableAgent() with the confirmed subcommand. Last error: ${lastErr}`,
  );
}
