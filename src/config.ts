import "dotenv/config";

export const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  guild: {
    apiKey: process.env.GUILD_API_KEY ?? "",
    workspace: process.env.GUILD_WORKSPACE ?? "",
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
