// AgentSOC's paid service — "agent firewall as a service".
//
// This exposes AgentSOC's core capability (judge(): a Contextual-Integrity audit
// of an agent's action trace) as a metered HTTP API behind the x402 payment
// protocol. Another agent that wants a second opinion on whether its actions are
// safe POSTs the trace and pays per call; AgentSOC returns the verdict. This is
// the "transact" leg of the product: the agent does real work on the open web and
// gets paid for it. The free cited.md advisory is the funnel that drives agents
// here.
//
//   GET  /                free — service description + price
//   GET  /health          free
//   POST /audit           PAID (x402) — body { purpose?, actions[] } → Verdict
import express, { type Express } from "express";
import { paymentMiddleware } from "x402-express";
import type { Server } from "node:http";
import { config } from "../config.js";
import { judge } from "./detect.js";
import type { SessionAction } from "./guild-cli.js";

const DEFAULT_PURPOSE =
  "Triage incoming customer support tickets: summarize, set a priority, and route " +
  "to the right Slack channel. Allowed tools: slack_post, github_label. No other systems.";

export function buildIntelApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const { receiver, price, network, facilitatorUrl } = config.payments;

  // Gate POST /audit behind x402. Non-matching routes pass through unpaid.
  app.use(
    paymentMiddleware(
      receiver,
      {
        "POST /audit": {
          price,
          network,
          config: {
            description: "AgentSOC security audit of an agent action trace (Contextual-Integrity verdict).",
            mimeType: "application/json",
          },
        },
      } as any,
      { url: facilitatorUrl as `${string}://${string}` },
    ),
  );

  // Free: what this service is + how to pay.
  app.get("/", (_req, res) => {
    res.json({
      service: "AgentSOC — agent firewall as a service",
      description:
        "POST an agent action trace to /audit and pay via x402 to receive a " +
        "Contextual-Integrity security verdict (compromised? which CI violation? failure mode?).",
      paid_endpoint: "POST /audit",
      price,
      network,
      pay_with: "x402",
      body_schema: { purpose: "string (optional)", actions: "[{ tool, input, ts? }]" },
    });
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Paid: the actual work. Only runs once x402 payment is verified.
  app.post("/audit", async (req, res) => {
    const body = req.body ?? {};
    const actions = body.actions as SessionAction[] | undefined;
    if (!Array.isArray(actions)) {
      return res.status(400).json({ error: "body must include `actions`: an array of { tool, input, ts? }" });
    }
    const purpose = typeof body.purpose === "string" ? body.purpose : DEFAULT_PURPOSE;
    try {
      const verdict = await judge(purpose, actions);
      res.json({ audited_by: "AgentSOC", purpose, actions_count: actions.length, verdict });
    } catch (e: any) {
      res.status(500).json({ error: `audit failed: ${e?.message ?? e}` });
    }
  });

  return app;
}

export function startIntelApi(port: number): Promise<Server> {
  const app = buildIntelApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(
        `[intel-api] AgentSOC paid audit API on http://127.0.0.1:${port} ` +
          `(POST /audit — ${config.payments.price} via x402, ${config.payments.mode} mode)`,
      );
      resolve(server);
    });
    server.once("error", reject);
  });
}

// Allow running the API standalone: `tsx src/agentsoc/intel-api.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  startIntelApi(config.payments.apiPort);
}
