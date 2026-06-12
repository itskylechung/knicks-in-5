import "dotenv/config";

export const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  guild: {
    // No API key: the `guild` CLI is authenticated via `guild auth login`
    // (browser OAuth) and the code shells out to it. Workspace can be set as a
    // default via `guild workspace select`, or overridden here.
    workspaceId: process.env.GUILD_WORKSPACE_ID ?? "",
    triagebotAgentId: process.env.TRIAGEBOT_AGENT_ID ?? "",
  },
  sensoKey: process.env.SENSO_API_KEY ?? "",
  // "runtime-deny" = block the hijacked credential request live (winning demo).
  // "cli-disable"  = detect deviation, then disable the agent (safe fallback).
  containmentMode: (process.env.CONTAINMENT_MODE ?? "cli-disable") as
    | "runtime-deny"
    | "cli-disable",
  // How often AgentSOC polls the Guild session audit trail (ms).
  pollIntervalMs: 3000,
};

export const MODEL = "claude-fable-5";
