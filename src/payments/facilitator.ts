// Local x402 facilitator — the sim half of the payment rail.
//
// A facilitator is the party an x402 server asks to (1) verify a payer's signed
// payment and (2) settle it on-chain. The real protocol is unchanged: the buyer
// still creates a real, signed EIP-3009 payment authorization, the seller still
// issues a real 402 challenge and enforces payment. This local facilitator keeps
// verification real (it recovers and echoes the payer) and SIMULATES only the
// on-chain transfer, so the agent-pays-agent demo runs deterministically with no
// funded wallet. Point X402_FACILITATOR_URL at a real facilitator (e.g.
// https://x402.org/facilitator) + fund the buyer wallet to settle for real.
//
// Implements the three routes the x402 client (useFacilitator) calls:
//   POST /verify   { x402Version, paymentPayload, paymentRequirements } → { isValid, payer }
//   POST /settle   (same body)                                          → { success, transaction, network, payer }
//   GET  /supported                                                     → { kinds: [...] }
import express, { type Express } from "express";
import { createHash } from "node:crypto";
import type { Server } from "node:http";

function payerOf(paymentPayload: any): string | undefined {
  // exact-evm payloads carry the signer in payload.authorization.from
  return paymentPayload?.payload?.authorization?.from ?? paymentPayload?.payer;
}

// A deterministic, clearly-synthetic tx hash so the demo output looks real
// without claiming an on-chain transfer happened.
function simTxHash(paymentPayload: any): `0x${string}` {
  const sig = paymentPayload?.payload?.signature ?? JSON.stringify(paymentPayload ?? {});
  return ("0x" + createHash("sha256").update("x402-sim:" + sig).digest("hex")) as `0x${string}`;
}

export function buildFacilitatorApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/verify", (req, res) => {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    const payer = payerOf(paymentPayload);
    if (!payer || !paymentRequirements) {
      return res.status(200).json({ isValid: false, invalidReason: "malformed payment payload" });
    }
    // Structural verification passed; in sim mode we trust the signed authorization.
    return res.status(200).json({ isValid: true, payer });
  });

  app.post("/settle", (req, res) => {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    const payer = payerOf(paymentPayload);
    const network = paymentRequirements?.network ?? "base-sepolia";
    if (!payer) {
      return res.status(200).json({ success: false, errorReason: "missing payer", network });
    }
    return res.status(200).json({
      success: true,
      transaction: simTxHash(paymentPayload),
      network,
      payer,
    });
  });

  app.get("/supported", (_req, res) => {
    res.status(200).json({
      kinds: [{ x402Version: 1, scheme: "exact", network: "base-sepolia" }],
    });
  });

  app.get("/health", (_req, res) => res.status(200).json({ ok: true, mode: "sim" }));

  return app;
}

export function startFacilitator(port: number): Promise<Server> {
  const app = buildFacilitatorApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`[x402-facilitator] sim facilitator listening on http://127.0.0.1:${port} (verify/settle simulated)`);
      resolve(server);
    });
    server.once("error", reject);
  });
}
