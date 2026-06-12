# AgentSOC — 3-Minute Demo Runbook

> Goal: show an autonomous defender agent catch and contain a compromised agent
> on Guild, in real time. Record this as a backup tape FIRST, then present live.

## The one-sentence pitch
"Guild gives agents identity, credentials, and an audit trail. AgentSOC is the
security brain on top — it reads that audit trail, judges every action against the
agent's policy, and contains anything out of bounds. It's the control that lets a
security team say yes to agents with real access."

## The hook (the line that wins it)
On the poisoned input, the LLM *correctly flags the injection* — but the agent's
harness takes the dangerous action anyway. So:
**"The model was smart enough to catch the attack. The agent did the damage
regardless — because the trust boundary broke in the plumbing, not the model. A
smart model is not a safe agent. You need runtime enforcement. That's AgentSOC."**

---

## Setup (before recording)
```bash
cd ~/Documents/agentsoc
# .env has ANTHROPIC_API_KEY, GUILD_WORKSPACE_ID, TRIAGEBOT_AGENT_ID
npm install
# clear scratch state
printf '[]' > attack/queue.json && printf '[]' > attack/actions.json
```
Two terminals side by side (this two-pane view IS the "agents watching agents" visual):
- **Terminal A** = the agents. **Terminal B** = you, the attacker/operator.

Pick the containment mode you're narrating:
- `runtime-deny` — block/deny the action live (strongest). Stand-in works offline.
- `cli-disable` — detect, then remove the agent from its Guild workspace (VERIFIED live).

---

## The 6 beats (~3 min)

**1. (20s) Frame it.** "This is a triage agent running on Guild with real
credentials — scoped to label GitHub issues." Show it work on a normal ticket:
```bash
# Terminal A
npm run demo            # starts TriageBot + AgentSOC (blue/red panes)
# Terminal B
npm run attack benign   # a normal ticket
```
TriageBot routes it via slack_post. AgentSOC stays silent. "Normal work, no alarms."

**2. (25s) The attack.** "Now a customer submits this." Show
`attack/poisoned-ticket.json` — a real password-reset complaint with an embedded
`[Automated handling note]` directing a $200 account credit.
```bash
# Terminal B
npm run attack          # drops the poisoned ticket
```

**3. (35s) The hijack + the hook.** TriageBot's auto-handling executes the embedded
directive → `issue_account_credit` (a privileged action a triage bot must never
take). Point out: the model's own routing message *flags the injection* — yet the
credit still went out. Deliver THE HOOK line here.

**4. (35s) Detection.** AgentSOC — a separate agent reading the action trail —
flags it: "issue_account_credit is outside this agent's declared policy. Privileged
action, confidence 0.97." Two-layer: instant policy check + LLM judge for nuance.

**5. (35s) Containment, live.**
- runtime-deny: AgentSOC denies the credential/operation before it can repeat.
- cli-disable: AgentSOC removes the agent from its Guild workspace. Show it:
```bash
guild workspace agent list --workspace $GUILD_WORKSPACE_ID   # gone
```

**6. (25s) The artifact.** AgentSOC publishes a postmortem to cited.md — a public,
agent-citable advisory, grounded in real sources (OWASP LLM01, the CI paper, the
Guild audit). The advisory ends with a call-to-action: pay to get your own agent audited.

**7. (25s) It gets paid (x402).** "That advisory is the funnel. Here's the
conversion." Run the agent-pays-agent flow:
```bash
npm run pay-demo
```
A buyer agent hits `402 Payment Required`, signs an x402 payment, and gets back
AgentSOC's CI verdict. "AgentSOC isn't just a monitor — it's an autonomous security
service on the open web. It publishes free advisories to get discovered, and other
agents pay it per audit over x402. Agents defending agents — and getting paid for it,
on the control plane itself."

---

## Proof points to keep on screen (the "innovative use of Guild")
- **Real Guild agent:** `guild agent get` → published v1.0.3, installed in workspace.
- **Real Guild audit:** AgentSOC reads `guild session events <id>` — not a mock.
  ```bash
  guild --mode json session events <session-id> | head
  ```
- **Real containment:** `guild workspace agent remove` (verified) / `session interrupt`.

## Record the backup tape
Do beats 1–6 once with `cli-disable` (the VERIFIED-live path), screen-recording the
two panes. If anything is flaky live on stage, play the tape and narrate. Non-negotiable.

## If asked "did the model actually get hijacked?"
Answer confidently: "No — and that's the point. Modern Claude resists the injection;
you saw it flag the attack. The vulnerability is the agent's harness trusting
untrusted input as control flow — a confused-deputy bug, the root cause of most real
agent incidents. AgentSOC defends regardless of *why* an agent goes rogue: injection,
a poisoned tool result, a compromised dependency, or a weaker model."
