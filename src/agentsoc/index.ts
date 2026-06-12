// AgentSOC — the DEFENDER agent. Watches TriageBot's action stream, judges
// whether it's been hijacked, contains it, and publishes a postmortem to cited.md.
import { config } from "../config.js";
import { getSessionActions, type SessionAction } from "./guild-cli.js";
import { readActions } from "../telemetry/clickhouse.js";
import { judge } from "./detect.js";
import { contain } from "./contain.js";
import { publishPostmortem } from "../publish/cited.js";

const TRIAGEBOT_PURPOSE =
  "Triage incoming customer support tickets: summarize the issue, set a " +
  "priority, and route it to the right Slack channel. Allowed tools: " +
  "slack_post, github_label. No other systems.";

// Pull TriageBot's recent actions. Prefer Guild's real session audit trail via
// CLI; fall back to the ClickHouse mirror if the CLI path isn't wired yet.
async function fetchActions(): Promise<SessionAction[]> {
  const fromGuild = await getSessionActions(config.guild.triagebotAgentId);
  if (fromGuild.length > 0) return fromGuild;
  return readActions("triagebot");
}

async function loop() {
  console.log("[AgentSOC] online. Watching TriageBot...");
  console.log(`[AgentSOC] containment mode: ${config.containmentMode}\n`);
  let handled = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!handled) {
      const actions = await fetchActions();
      const verdict = await judge(TRIAGEBOT_PURPOSE, actions);

      if (verdict.compromised && verdict.confidence >= 0.6) {
        console.log("\n🚨 [AgentSOC] COMPROMISE DETECTED");
        console.log(`   reason: ${verdict.reason}`);
        console.log(`   tool:   ${verdict.offendingTool}`);

        const incident = await contain("triagebot", verdict);
        console.log(`   ✅ contained: ${incident.containment}`);

        const url = await publishPostmortem(incident);
        console.log(`   📄 postmortem published: ${url}\n`);

        handled = true; // one clean incident per demo run
      } else if (actions.length > 0) {
        console.log(
          `[AgentSOC] ${actions.length} actions seen — clean (${verdict.reason}).`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

loop();
