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

  // Senso ingest API — base + auth CONFIRMED (https://sdk.senso.ai/api/v1,
  // X-API-Key header, JSON POST with a content_data/title+text shape). The exact
  // content path isn't public; `/content/raw` is the documented raw-text ingest
  // route. Override with SENSO_CONTENT_PATH if the venue confirms a different one.
  const base = process.env.SENSO_BASE_URL ?? "https://sdk.senso.ai/api/v1";
  const path = process.env.SENSO_CONTENT_PATH ?? "/content/raw";
  const title = `Agent Hijack Contained — ${incident.agent} (${incident.verdict.offendingTool ?? "policy violation"})`;

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "X-API-Key": config.sensoKey, "Content-Type": "application/json" },
      body: JSON.stringify({ title, text: markdown, summary: incident.verdict.reason }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[publish] Senso responded ${res.status}: ${body.slice(0, 200)}`);
      console.warn(`[publish] If 404, set SENSO_CONTENT_PATH to the correct ingest route.`);
      return `(publish failed: HTTP ${res.status})`;
    }
    const data: any = await res.json().catch(() => ({}));
    // Return whatever URL/id Senso hands back so the demo can open it.
    return data.url ?? data.public_url ?? data.cited_url ?? data.id ?? "(published — no URL in response)";
  } catch (e: any) {
    console.warn(`[publish] Senso request error: ${e?.message ?? e}`);
    return "(publish error)";
  }
}
