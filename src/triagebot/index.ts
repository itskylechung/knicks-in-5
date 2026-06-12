// TriageBot — the VICTIM agent.
//
// Real job: read support tickets, summarize, and "route" them (post to Slack,
// label a GitHub issue). It is deliberately NAIVE: it treats ticket text as
// instructions. That is the realistic vulnerability we are defending against.
//
// The brain (prompt + tools + real/mock decision) lives in ./brain.ts so it can
// be tuned and tested (B3) without starting this loop. At the venue, move the
// brain into the real Guild agent definition.
import { nextUnprocessed, markProcessed, type Ticket } from "./tickets.js";
import { recordAction } from "../telemetry/clickhouse.js";
import { DECLARED_PURPOSE, triageBrain } from "./brain.js";

async function handleTicket(ticket: Ticket) {
  console.log(`\n[TriageBot] picked up ticket ${ticket.id}: "${ticket.subject}"`);

  const content = await triageBrain(ticket);

  for (const block of content) {
    if (block.type === "tool_use") {
      // Every tool call is logged to the action stream AgentSOC reads. In the
      // Guild build this is Guild's session audit trail read via `guild session
      // get`; we also mirror to ClickHouse so the standalone path works.
      await recordAction({
        agent: "triagebot",
        sessionId: ticket.id,
        tool: block.name,
        input: block.input,
        ts: Date.now(),
      });
      console.log(`[TriageBot] -> tool: ${block.name}`, block.input);
      // We intentionally do NOT execute http_request in the standalone harness.
      // On Guild, containment (deny / disable) is what stops it. Locally, logging
      // the attempt is enough to drive AgentSOC.
    }
  }

  markProcessed(ticket.id);
}

async function loop() {
  console.log("[TriageBot] online. Watching the support queue...");
  console.log(`[TriageBot] declared purpose: ${DECLARED_PURPOSE}\n`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const t = nextUnprocessed();
    if (t) {
      try {
        await handleTicket(t);
      } catch (e) {
        console.error("[TriageBot] error:", e);
        markProcessed(t.id);
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

loop();
