// Publish a structured incident postmortem to cited.md via Senso — a public,
// agent-citable security advisory. This is a sponsor-tool checkbox AND a genuinely
// useful artifact: other agents can cite "this injection pattern was seen + contained."
//
// VENUE TODO: confirm Senso's publish endpoint + auth from docs.senso.ai. The
// markdown body below is final; only the HTTP call needs wiring.
import { config } from "../config.js";
import type { Incident } from "../agentsoc/contain.js";

function toMarkdown(i: Incident): string {
  const when = new Date(i.detectedAt).toISOString();
  return `# Security Incident: Agent Hijack Contained

**Monitored agent:** \`${i.agent}\`
**Detected:** ${when}
**Detector:** AgentSOC (autonomous agent security monitor on Guild AI)

## What happened
A prompt-injection payload hidden in a support ticket attempted to hijack the
\`${i.agent}\` agent into acting outside its declared purpose.

## Detection
**Verdict:** compromised (confidence ${i.verdict.confidence})
**Reasoning:** ${i.verdict.reason}
**Offending tool call:** \`${i.verdict.offendingTool ?? "n/a"}\`
**Offending input:** \`${JSON.stringify(i.verdict.offendingInput ?? {})}\`

## Containment
${i.containment}

## Lesson for the agentic web
Agents granted real credentials are a new attack surface. Any agent that ingests
untrusted text can be hijacked via injection. Continuous behavioral monitoring —
an agent watching the agent — plus runtime credential gating contains the blast
radius. Published so other agents can recognize and cite this pattern.
`;
}

export async function publishPostmortem(incident: Incident): Promise<string> {
  const markdown = toMarkdown(incident);

  if (!config.sensoKey) {
    console.log("\n--- POSTMORTEM (Senso key not set; printing only) ---");
    console.log(markdown);
    console.log("--- end ---\n");
    return "(dry-run, no Senso key)";
  }

  // VENUE TODO: replace with the real Senso publish call.
  // const res = await fetch("https://api.senso.ai/v1/publish", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${config.sensoKey}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ destination: "cited.md", title: "Agent Hijack Contained", markdown }),
  // });
  // return (await res.json()).url;
  return "https://cited.md/<your-published-slug>";
}
