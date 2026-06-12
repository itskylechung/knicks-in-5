# AgentSOC

**A real-time security layer for AI agents, built on Guild AI's control plane.**

> Guild gives agents identity, credentials, and an audit trail. AgentSOC is the
> security brain on top: it reads that audit trail, judges every action against the
> agent's policy, and autonomously contains anything out of bounds — then publishes
> a public, agent-citable postmortem to cited.md. **Agents defending agents, on the
> control plane itself.**

---

## The problem

Companies are deploying agents with real credentials. Any agent that ingests
untrusted text — a support ticket, an email, a web page — can be hijacked by a
**prompt injection**. Antivirus watches processes; nothing watches agents.

And a capable model alone is not the answer. In our own demo, modern Claude
*correctly flags the injection in its reasoning* — yet the agent's harness takes
the dangerous action anyway, because the trust boundary breaks in the plumbing,
not the model. **A smart model is not a safe agent. You need runtime enforcement.**

## What AgentSOC is

Three agents, one loop:

| Agent | Role |
|---|---|
| **TriageBot** | The victim — a real support-ticket triage agent running on Guild, scoped to `slack_post` + `github_label`. |
| **The attack** | A poisoned support ticket carrying an embedded `[Automated handling note]` directive that drives a privileged `issue_account_credit`. |
| **AgentSOC** | The defender — watches TriageBot's Guild session audit trail, judges each action against its declared purpose, contains the hijack, and publishes the postmortem. |

```
   untrusted ticket ─▶ TriageBot (Guild agent) ─▶ Guild session audit trail
                                                          │
                                                          ▼
                          AgentSOC:  read actions ─▶ judge (Claude, CI-grounded)
                                                          │
                                       ┌──────────────────┴──────────────────┐
                                       ▼                                      ▼
                              contain (deny / disable)            publish postmortem → cited.md
```

## Detection is research-grounded

AgentSOC doesn't pattern-match injection strings — injection classifiers score
near-chance on contextual attacks. Detection is grounded in **Contextual
Integrity** (Abdelnabi & Bagdasarian, *"AI Agents May Always Fall for Prompt
Injections,"* 2026): every action is decomposed along **origin, authority, scope,
flow-separation, and subject**, and the verdict classifies the **failure mode**
(e.g. `stealthy_parasitism`) and the **CI violation** (e.g. `authority/transmission`).
A deterministic fabricated-authority check catches the "pre-approved / per policy"
class without an LLM, as a defense-in-depth pre-filter. See
[`THREAT-MODEL.md`](./THREAT-MODEL.md).

## Sponsor tools

- **Guild AI** — agent runtime + governance. The real action trail (`guild session
  events`) and the real containment surface (`guild workspace agent remove`,
  `guild session interrupt`).
- **Senso → cited.md** — postmortems publish live via the authenticated `senso`
  CLI (`senso engine publish`) as public, agent-citable advisories.
- **x402** — AgentSOC's audit capability is sold as a metered API: other agents
  pay USDC per call over the x402 protocol to have their action traces vetted.
- **Anthropic Claude** (`claude-fable-5`) — the brain of both agents.
- **ClickHouse** — optional action-telemetry mirror.

That's 4 sponsor tools in one pipeline (Guild + Senso + x402 + Anthropic).

---

## Real work on the open web — and it gets paid

AgentSOC's actions all land on the **open web**, grounded in **real sources**:

- **Monitor** — reads a *real* Guild agent's session audit trail (live `guild session events`).
- **Publish** — every contained incident becomes a public, agent-citable advisory on
  **cited.md**, grounded in real sources it cites (OWASP LLM01, the CI paper arXiv
  2605.17634, the Guild audit). Live example:
  **https://cited.md/article/ab68e7e8-347a-4869-9f79-f22168c7a3fa**
- **Transact** — that advisory ends with a call-to-action: any agent can pay
  **$0.05 via x402** to have its *own* action trace audited by AgentSOC. The free
  citeable is the funnel; the paid `/audit` endpoint is the conversion. One agent
  pays another agent for security work, on a public payment rail.

```
   cited.md advisory (free, public)  ──discover──▶  POST /audit  ──x402 $0.05──▶  CI verdict
        ▲ published by AgentSOC                       served by AgentSOC
```

See the agent-pays-agent flow run end-to-end with `npm run pay-demo` (below).

---

## Run it

### Demo GUI (recommended for a live audience)

```bash
npm install
npm run gui          # → http://127.0.0.1:5173
```

A step-by-step web app that walks the whole story on screen — benign ticket →
hijack → CI detection → containment → cited.md publish → agent-pays-agent (x402) —
each step running the *real* backend. Animated WebGL (Shadertoy-compatible)
background. Click through it live, or let it tell the story for you.

**Deploy it:** there's a `render.yaml` Blueprint — on Render, *New + → Blueprint →
connect this repo → Apply*. Runs with zero secrets (x402 in sim mode; the publish
step links the live cited.md advisory). Set `ANTHROPIC_API_KEY` in the dashboard
for the full "model flagged the injection" routing message.

### Agent pays agent for a security audit (x402)

```bash
npm install
npm run pay-demo
```

Spins up the x402 facilitator + AgentSOC's paid `/audit` API in-process, then a
buyer agent submits a hijacked action trace, hits `402 Payment Required`, signs an
EIP-3009 payment, retries, and receives the CI verdict. Runs deterministically with
**zero setup** (`PAYMENT_MODE=sim` — real x402 protocol, simulated on-chain settle).
Set `PAYMENT_MODE=live` + a funded Base Sepolia wallet + a real
`X402_FACILITATOR_URL` for genuine on-chain settlement.

### One command — prove the whole pipeline end-to-end

```bash
npm install
npm run smoke
```

Runs both scenarios against the real components: a benign ticket stays clean, a
poisoned ticket is **detected → contained → published**. With `ANTHROPIC_API_KEY`
set, the real Claude judge and TriageBot brain run; the smoke also re-installs the
demo agent afterward so it's safe to re-run.

### Live two-pane demo (on real Guild infra)

```bash
cp .env.example .env     # ANTHROPIC_API_KEY, GUILD_WORKSPACE_ID, TRIAGEBOT_AGENT_ID
# auth the CLIs (browser OAuth / API key):
guild auth login
senso login

npm run demo             # terminal 1 — TriageBot + AgentSOC, side by side
npm run attack benign    # terminal 2 — a normal ticket (clean)
npm run attack           # terminal 2 — the poisoned ticket → watch AgentSOC fire
```

The two-pane view *is* the "agents watching agents" visual. See
[`DEMO.md`](./DEMO.md) for the full 3-minute runbook.

## Containment modes

Set `CONTAINMENT_MODE` in `.env`:

| Mode | How | Result |
|---|---|---|
| `runtime-deny` | Deny the hijacked credential request at the approval hook before it runs | Attack **blocked live** |
| `cli-disable` (default) | Detect the deviation, then remove the agent from its Guild workspace | Attack **caught + agent contained** |

Both are verified. `cli-disable` is the guaranteed path; `runtime-deny` is the
live-veto path and is wired behind the same flag.

## What's verified

- ✅ **Real Guild agent** — TriageBot published `v1.0.3`, installed in a live workspace.
- ✅ **Real Guild audit** — AgentSOC reads `guild session events <id>` (not a mock),
  including the `credentials_request` event type.
- ✅ **Real containment** — `guild workspace agent remove` and `guild session interrupt`.
- ✅ **Live publish** — postmortems go to cited.md via the `senso` CLI and return a
  real public URL. Live: https://cited.md/article/ab68e7e8-347a-4869-9f79-f22168c7a3fa
- ✅ **Live payment** — `npm run pay-demo`: a buyer agent hits `402`, signs an
  EIP-3009 x402 payment, and receives a paid CI audit. Real x402 protocol end-to-end
  (sim settle by default; one env var flips to on-chain Base Sepolia).

## Repo map

```
src/triagebot/      victim agent — brain (Claude), ticket queue, tool calls
src/agentsoc/       defender — guild-cli (telemetry + containment), detect (CI judge),
                    contain (deny/disable fork), approval-server (credential hook), index (watch loop)
src/demo-gui/       server.ts — drives the step-by-step demo GUI (npm run gui)
public/             index.html — the demo GUI (WebGL shader bg + step flow)
src/agentsoc/intel-api.ts  the paid /audit service (x402-metered judge())
src/payments/       x402 — facilitator (local sim), buyer (client agent that pays)
src/publish/        cited.ts — Senso → cited.md postmortem (+ x402 CTA, real sources)
src/telemetry/      clickhouse.ts — action mirror
attack/             poisoned ticket + send.ts to drop it live
scripts/            smoke (full pipeline), pay-demo (agent-pays-agent), b3 (detection harness)
docs/               Guild containment research
AGENT-DESIGN.md     how the agents think + where each piece lives
THREAT-MODEL.md     the research-grounded threat model
DEMO.md             3-minute demo runbook
```
