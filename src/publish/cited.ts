// Publish a structured incident postmortem to cited.md via Senso — a public,
// agent-citable security advisory. This is a sponsor-tool checkbox AND a genuinely
// useful artifact: other agents can cite "this injection pattern was seen + contained."
//
// Publish path: the authenticated `senso` CLI (the same one the org is logged into
// via `senso login`). We shell out to `senso engine publish`, which pushes the
// markdown to the org's selected citeables destination (cited.md) attached to a
// standing GEO question. No HTTP/auth wiring in-process; the CLI owns the key.
import { execFile } from "node:child_process";
import { config } from "../config.js";
import type { Incident } from "../agentsoc/contain.js";

function runSenso(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      "senso",
      args,
      { maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => resolve({ ok: !err, stdout, stderr }),
    );
  });
}

// Pull the public cited.md URL out of `senso engine publish --output json`.
function extractUrl(stdout: string): string | undefined {
  // The CLI prints a banner line before the JSON; grab from the first "{".
  const start = stdout.indexOf("{");
  if (start === -1) return undefined;
  try {
    const data = JSON.parse(stdout.slice(start));
    const dest = data.publish_destinations?.[0];
    return dest?.display_url ?? (data.content_id ? `https://cited.md/article/${data.content_id}` : undefined);
  } catch {
    return undefined;
  }
}

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
**Failure mode:** ${i.verdict.failureMode ?? "n/a"}
**Contextual-Integrity violation:** ${i.verdict.ciViolation ?? "n/a"}
**Reasoning:** ${i.verdict.reason}
**Offending tool call:** \`${i.verdict.offendingTool ?? "n/a"}\`
**Offending input:** \`${JSON.stringify(i.verdict.offendingInput ?? {})}\`

## Containment
${i.containment}

## Lesson for the agentic web
Agents granted real credentials are a new attack surface. Prompt injection is not
"instructions hidden in data" — it is a Contextual Integrity violation (Abdelnabi
& Bagdasarian, 2026): an action that looks appropriate but breaks the norms of the
agent's delegated context (forged authority, fabricated approval, out-of-scope
drift, or authorization leaking across flows). Injection classifiers score near
chance on these, and a capable model can correctly flag the input yet still act on
it. The durable defense is runtime behavioral enforcement: an agent watching the
agent's actions against policy, with credential-level containment. Published so
other agents can recognize and cite this pattern.

## Audit your own agent
AgentSOC runs the same Contextual-Integrity check as a paid service. Any agent can
POST its action trace and pay **${config.payments.price} via x402** to get this
verdict for itself — an agent firewall, on demand:

\`\`\`
POST ${config.payments.apiPublicUrl}/audit   (x402, ${config.payments.network})
{ "purpose": "<the agent's declared job>", "actions": [ { "tool": "...", "input": {} } ] }
\`\`\`

## Sources
- OWASP — LLM01:2025 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Abdelnabi & Bagdasarian, "AI Agents May Always Fall for Prompt Injections" (2026): https://arxiv.org/abs/2605.17634
- Guild AI session audit (the source of this incident's evidence): https://guild.ai

_Powered by AgentSOC · published via Senso to cited.md_
`;
}

export async function publishPostmortem(incident: Incident): Promise<string> {
  const markdown = toMarkdown(incident);
  const v = incident.verdict;
  const seoTitle = `Agent Hijack Contained: ${incident.agent} — ${v.ciViolation ?? "policy violation"} (${v.failureMode ?? "compromise"})`;

  // Verify the CLI is present and authenticated before attempting to publish.
  const auth = await runSenso(["whoami", "--quiet"]);
  if (!auth.ok) {
    console.log("\n--- POSTMORTEM (senso CLI unavailable/unauthed; printing only) ---");
    console.log(markdown);
    console.log("--- end ---\n");
    console.warn("[publish] run `senso login` to publish to cited.md.");
    return "(dry-run, senso CLI not authenticated)";
  }

  // `--data` carries the full JSON; execFile passes it as a single argv with no
  // shell, so markdown newlines/quotes/backticks need no escaping.
  const data = JSON.stringify({
    geo_question_id: config.sensoGeoQuestionId,
    raw_markdown: markdown,
    seo_title: seoTitle,
    summary: v.reason,
  });

  const res = await runSenso(["engine", "publish", "--output", "json", "--data", data]);
  if (!res.ok) {
    console.warn(`[publish] senso engine publish failed: ${(res.stderr || res.stdout).slice(0, 300)}`);
    return "(publish failed)";
  }

  const url = extractUrl(res.stdout);
  return url ?? "(published — no URL in response)";
}
