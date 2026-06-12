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
  // "runtime-deny" = block the hijacked credential request live (live-deny path).
  // "cli-disable"  = detect deviation, then disable the agent (guaranteed path).
  containmentMode: (process.env.CONTAINMENT_MODE ?? "cli-disable") as
    | "runtime-deny"
    | "cli-disable",
  // How often AgentSOC polls the Guild session audit trail (ms).
  pollIntervalMs: 3000,

  // ── Monetization (x402) ──────────────────────────────────────────────────
  // AgentSOC sells its core capability — a security audit of an agent action
  // trace — as a metered API. Other agents pay per call over the x402 protocol.
  // The free cited.md advisory is the funnel; this paid /audit endpoint is the
  // conversion. Both rubric legs (publish + transact) on one pipeline.
  payments: {
    // "sim"  = real x402 client/server protocol against a LOCAL facilitator;
    //          on-chain settle is simulated, so the agent-pays-agent demo runs
    //          with zero setup (no funded wallet).
    // "live" = real on-chain settlement on Base Sepolia via a public facilitator
    //          (needs the buyer wallet funded with testnet USDC).
    mode: (process.env.PAYMENT_MODE ?? "sim") as "sim" | "live",
    network: (process.env.PAYMENT_NETWORK ?? "base-sepolia") as "base-sepolia" | "base",
    price: process.env.AUDIT_PRICE ?? "$0.05",
    // Where AgentSOC receives payment. In sim mode any address is fine.
    receiver: (process.env.PAYMENT_RECEIVER ??
      "0x209693Bc6afc0C5328bA36FaF03C514EF312287C") as `0x${string}`,
    // Facilitator that verifies + settles payments. Defaults to the local sim
    // facilitator; set to a real one (e.g. https://x402.org/facilitator) for live.
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "http://127.0.0.1:8788",
    facilitatorPort: Number(process.env.X402_FACILITATOR_PORT ?? 8788),
    // The paid intel API.
    apiPort: Number(process.env.INTEL_API_PORT ?? 4021),
    // Public base URL of the paid API, used in the cited.md call-to-action so an
    // agent that discovers the advisory on the open web can reach the endpoint.
    apiPublicUrl: process.env.INTEL_API_PUBLIC_URL ?? "http://127.0.0.1:4021",
    // Buyer wallet (the client agent). In sim mode a random key is generated.
    buyerPrivateKey: process.env.BUYER_PRIVATE_KEY ?? "",
  },
};

export const MODEL = "claude-fable-5";
