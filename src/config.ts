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
  // Geo question the postmortems answer on cited.md. Defaults to the org's
  // standing "What incidents has AgentSOC detected and contained?" question.
  sensoGeoQuestionId:
    process.env.SENSO_GEO_QUESTION_ID ?? "3da3aaff-e1c2-4a75-860c-ecd327c39df3",
  // "runtime-deny" = block the hijacked credential request live (winning demo).
  // "cli-disable"  = detect deviation, then disable the agent (safe fallback).
  containmentMode: (process.env.CONTAINMENT_MODE ?? "cli-disable") as
    | "runtime-deny"
    | "cli-disable",
  // How often AgentSOC polls the Guild session audit trail (ms).
  pollIntervalMs: 3000,
};

export const MODEL = "claude-fable-5";
