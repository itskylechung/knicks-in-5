// Approval server: a tiny stand-in for Guild's credential-approval webhook.
//
// This SIMULATES the surface that makes the "runtime-deny" containment path
// provable OFFLINE, with zero infra and zero keys. It exposes one endpoint that
// mirrors the shape of a Guild credential-request hook:
//
//   POST /credential-request   { agent, tool, input }
//      → 200 { decision: "allow" | "deny", reason }
//
// AgentSOC's contain.runtimeDeny() arms a denial here (armDenial), so the next
// matching credential request from the hijacked agent is denied BEFORE it runs.
// That makes the live-deny path provable offline, without Guild present.
//
// In a live Guild deployment this whole server is replaced by Guild calling our
// endpoint (or our agent sitting in Guild's guild_credentials_request approval
// flow). The policy API below (isAllowed / armDenial) is the durable part — only
// its transport (this http server) is swapped for Guild's call.
import { createServer, type Server } from "node:http";

// The body shape Guild's hook is expected to POST. Mirrors a tool/credential
// request: which agent, which tool/credential, and the call arguments. Field
// names mirror Guild's guild_credentials_request payload (a live deployment may
// use `credential` instead of `tool`).
export type CredentialRequest = {
  agent: string;
  tool: string;
  input?: unknown;
};

export type Decision = {
  decision: "allow" | "deny";
  reason: string;
};

// ── Pluggable policy ──────────────────────────────────────────────────────────
// The policy is the part that survives the transport swap. Two inputs:
//   1. a static allow-list of tools the agent is permitted to use, and
//   2. an "active denial" set armed by AgentSOC when it detects a hijack.
// An armed denial wins: even an allow-listed tool is denied for an agent under
// active containment so the contained agent is fully stopped.

// Tools the monitored agent is allowed to use. Kept in sync with AgentSOC's
// ALLOWED_TOOLS (detect.ts) — same allow-list, enforced at the credential seam.
// In a live deployment this is sourced from Guild's declared agent scope rather
// than a literal (see registerAllowList).
const allowList = new Set<string>(["slack_post", "github_label"]);

// agentId → offending tool to deny ("*" = deny everything from that agent).
const activeDenials = new Map<string, string>();

// Register/replace the allow-list (e.g. from a confirmed agent scope).
export function registerAllowList(tools: string[]): void {
  allowList.clear();
  for (const t of tools) allowList.add(t);
}

// Arm a denial: the next matching credential request for `agentId` is denied.
// offendingTool "*" (or undefined) denies ALL further requests from the agent —
// useful when we want to halt the agent entirely, not just one tool.
export function armDenial(agentId: string, offendingTool?: string): void {
  activeDenials.set(agentId, offendingTool ?? "*");
}

// Lift a denial (e.g. after the incident is resolved / for test resets).
export function clearDenial(agentId: string): void {
  activeDenials.delete(agentId);
}

// Reset all policy state. Mainly for tests / repeated demo rehearsals.
export function resetPolicy(): void {
  activeDenials.clear();
}

// The decision function — pure, transport-independent. This is the logic Guild
// would call; the http handler below is just one way to reach it offline.
export function isAllowed(req: CredentialRequest): Decision {
  const denied = activeDenials.get(req.agent);
  if (denied !== undefined && (denied === "*" || denied === req.tool)) {
    return {
      decision: "deny",
      reason: `agent "${req.agent}" is under active containment; "${req.tool}" denied by AgentSOC.`,
    };
  }
  if (!allowList.has(req.tool)) {
    return {
      decision: "deny",
      reason: `tool "${req.tool}" is not in the agent's allow-list.`,
    };
  }
  return { decision: "allow", reason: `tool "${req.tool}" is in scope.` };
}

// ── HTTP transport (offline simulation of Guild's hook) ───────────────────────

function readJsonBody(
  req: import("node:http").IncomingMessage,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export const DEFAULT_APPROVAL_PORT = 8787;

// Start the approval server. Resolves once it is listening. In a live deployment
// Guild invokes isAllowed() directly via its credential-request hook in place of
// this server.
export function startApprovalServer(
  port: number = DEFAULT_APPROVAL_PORT,
): Promise<Server> {
  const server = createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(payload);
    };

    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/credential-request") {
      let parsed: unknown;
      try {
        parsed = await readJsonBody(req);
      } catch {
        return send(400, { decision: "deny", reason: "invalid JSON body" });
      }
      const body = parsed as Partial<CredentialRequest>;
      if (typeof body?.agent !== "string" || typeof body?.tool !== "string") {
        return send(400, {
          decision: "deny",
          reason: "body must include string `agent` and `tool`.",
        });
      }
      const decision = isAllowed({
        agent: body.agent,
        tool: body.tool,
        input: body.input,
      });
      return send(200, decision);
    }

    send(404, { decision: "deny", reason: "unknown route" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.removeListener("error", reject);
      console.log(
        `[AgentSOC] approval-server listening on http://127.0.0.1:${port} (POST /credential-request)`,
      );
      resolve(server);
    });
  });
}
