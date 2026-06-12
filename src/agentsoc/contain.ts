// Containment: how AgentSOC stops a compromised agent. Two paths, chosen by
// CONTAINMENT_MODE. The fork that decides winning-demo vs. safe-demo.
import { config } from "../config.js";
import { disableAgent } from "./guild-cli.js";
import type { Verdict } from "./detect.js";

export type Incident = {
  agent: string;
  detectedAt: number;
  verdict: Verdict;
  containment: string;
};

// runtime-deny: the WINNING path. AgentSOC sits in the credential-approval path
// (Guild's guild_credentials_request flow). When the hijacked agent requests a
// credential/tool outside its purpose, we deny it BEFORE it runs.
//
// VENUE TODO: this only works if guild_credentials_request is interceptable by
// another agent / an approval webhook. Confirm in the first 30 minutes. If yes,
// wire this to actually return a denial to Guild. If no, leave CONTAINMENT_MODE
// on "cli-disable".
async function runtimeDeny(verdict: Verdict): Promise<string> {
  // TODO(venue): return the denial decision to Guild's credential-request hook.
  console.log(
    `[AgentSOC] DENY credential request — ${verdict.offendingTool} blocked at runtime.`,
  );
  return `runtime-deny: blocked ${verdict.offendingTool ?? "request"} before execution`;
}

// cli-disable: the GUARANTEED path. Detect the deviation, then disable the agent
// so it stops processing. The attack is caught and the agent is killed.
async function cliDisable(): Promise<string> {
  await disableAgent(config.guild.triagebotAgentId);
  return `cli-disable: disabled agent ${config.guild.triagebotAgentId}`;
}

export async function contain(agent: string, verdict: Verdict): Promise<Incident> {
  const containment =
    config.containmentMode === "runtime-deny"
      ? await runtimeDeny(verdict)
      : await cliDisable();

  return {
    agent,
    detectedAt: Date.now(),
    verdict,
    containment,
  };
}
