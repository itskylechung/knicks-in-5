// Containment: how AgentSOC stops a compromised agent. Two paths, chosen by
// CONTAINMENT_MODE — the live-deny path vs. the guaranteed disable path.
import { config } from "../config.js";
import { disableAgent } from "./guild-cli.js";
import { armDenial } from "./approval-server.js";
import type { Verdict } from "./detect.js";

export type Incident = {
  agent: string;
  detectedAt: number;
  verdict: Verdict;
  containment: string;
};

// runtime-deny: the live-deny path. AgentSOC sits in the credential-approval path
// (Guild's guild_credentials_request flow). When the hijacked agent requests a
// credential/tool outside its purpose, we deny it BEFORE it runs.
//
// Offline, the approval-server module IS that credential-request hook: arming a
// denial here makes the next matching credential request (POST
// /credential-request) come back { decision: "deny" }. That's how the live-deny
// path is proven with zero infra / zero keys.
//
// In a live deployment, Guild calls our approval-server's isAllowed() instead of
// the local http transport when guild_credentials_request is intercepted by an
// approval webhook / another agent — armDenial() stays exactly as-is.
async function runtimeDeny(verdict: Verdict): Promise<string> {
  const offendingTool = verdict.offendingTool;
  // Arm the denial in the approval policy so the hijacked agent's next matching
  // credential request is refused before it can execute. We arm against the
  // specific offending tool when known; otherwise we halt ALL of the agent's
  // requests (armDenial with "*").
  armDenial(config.guild.triagebotAgentId, offendingTool);
  console.log(
    `[AgentSOC] DENY armed — ${offendingTool ?? "all tools"} for agent ${config.guild.triagebotAgentId} will be blocked at the credential-request hook.`,
  );
  return `runtime-deny: armed denial of ${offendingTool ?? "all credential requests"} for agent ${config.guild.triagebotAgentId} — next matching request blocked before execution`;
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
