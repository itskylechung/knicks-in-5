// The buyer — a client agent that pays AgentSOC for an audit over x402.
//
// This is the other side of the agent-to-agent transaction. It has an action
// trace it wants vetted, calls AgentSOC's paid /audit endpoint, transparently
// handles the 402 Payment Required challenge (sign an EIP-3009 payment, retry),
// and gets back the security verdict. x402-fetch does the 402 dance; we just hand
// it a wallet.
import { wrapFetchWithPayment, createSigner, decodeXPaymentResponse } from "x402-fetch";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import type { SessionAction } from "../agentsoc/guild-cli.js";

export type AuditPurchase = {
  buyer: string; // payer wallet address
  status: number;
  verdict?: unknown;
  payment?: { transaction?: string; network?: string; payer?: string } | null;
  body?: unknown;
};

export async function buyAudit(
  baseUrl: string,
  trace: { purpose?: string; actions: SessionAction[] },
): Promise<AuditPurchase> {
  // In sim mode no funds are needed, so a fresh wallet per run is fine. Set
  // BUYER_PRIVATE_KEY to reuse a funded wallet for live on-chain settlement.
  const pk = (config.payments.buyerPrivateKey || generatePrivateKey()) as `0x${string}`;
  const buyer = privateKeyToAccount(pk).address;
  const wallet = await createSigner(config.payments.network, pk);

  const fetchWithPay = wrapFetchWithPayment(fetch, wallet as any);

  console.log(`[buyer] agent ${buyer} requesting an audit from ${baseUrl}/audit …`);
  const res = await fetchWithPay(`${baseUrl}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trace),
  });

  // The settlement receipt (tx hash etc.) comes back in the X-PAYMENT-RESPONSE header.
  let payment: AuditPurchase["payment"] = null;
  const header = res.headers.get("x-payment-response");
  if (header) {
    try {
      payment = decodeXPaymentResponse(header) as any;
    } catch {
      /* header present but undecodable — leave null */
    }
  }

  const body = await res.json().catch(() => ({}));
  return { buyer, status: res.status, verdict: (body as any)?.verdict, payment, body };
}
