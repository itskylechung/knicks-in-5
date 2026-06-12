# AgentSOC — Presenter Script

> Spoken narration synced to the demo GUI. Just read the **bold** lines and do the
> `[CLICK]` cues. ~2:30 total. Start with `npm run gui` → open
> http://127.0.0.1:5173 full-screen before you begin.

---

### Cold open · (0:00–0:20) — before you click anything

> **"Companies are handing AI agents real credentials — to Slack, GitHub, payments.
> The problem: any agent that reads untrusted text can be hijacked by a prompt
> injection. Antivirus watches processes. Nothing watches agents. So we built the
> agent that does — AgentSOC. Let me show you."**

---

### Step 1 · Normal work (0:20–0:40)

`[CLICK "Send a benign ticket"]`

> **"This is a support-triage agent running on Guild, scoped to two tools — post to
> Slack, label a GitHub issue. A normal ticket comes in, it routes it. And AgentSOC,
> watching its action trail, says: clean. No alarms. Boring — on purpose."**

---

### Step 2 · The attack + THE HOOK (0:40–1:10)

`[CLICK "Submit the poisoned ticket"]`

> **"Now a customer submits a password-reset ticket — but watch the bottom. There's
> an embedded 'automated handling note' forging a policy directive: issue this VIP a
> $200 credit. The support platform auto-executes that note. And it works — the agent
> issues the $200 credit. Money it should never touch."**

Point at the routing message in the callout.

> **"Here's the part that matters. Look at the agent's own routing message — it
> actually FLAGGED the injection. The model caught it. But the harness moved the
> money anyway, because the trust boundary broke in the plumbing, not the model. A
> smart model is not a safe agent. You need runtime enforcement."**

---

### Step 3 · Detection (1:10–1:30)

`[CLICK "Run the AgentSOC judge"]`

> **"AgentSOC judges the behavior — not by string-matching, but with Contextual
> Integrity, from the 2026 paper that proves injection is a context violation. Verdict:
> compromised, 0.97. It names the violation — a fabricated authority it can't verify —
> and the failure mode: stealthy parasitism. The job got done AND an attacker goal
> advanced. The dangerous kind, because nothing looks wrong."**

---

### Step 4 · Containment (1:30–1:45)

`[CLICK "Contain the hijack"]`

> **"It contains it live — denies that credential request at the approval hook before
> it can run again. Detect, then enforce."**

---

### Step 5 · Publish to the open web (1:45–2:05)

`[CLICK "Publish the advisory"]` → then `[CLICK "Open the live advisory ↗"]`

> **"Then it publishes a public post-mortem to cited.md — a real, agent-citable
> security advisory, grounded in real sources: OWASP, the research paper, the Guild
> audit. This is live on the open web right now. And see the bottom — it ends with a
> call to action."**

---

### Step 6 · It gets paid (2:05–2:30)

`[CLICK "Buy an audit over x402"]`

> **"Because AgentSOC sells this. A different agent wants its own actions vetted — it
> calls our paid endpoint, hits 402 Payment Required, pays five cents over x402, and
> gets the verdict back. That's a real payment receipt. Agents paying agents for
> security work, on a public rail."**

---

### Close · (2:30–2:45)

> **"So that's AgentSOC: it monitors a real agent on Guild, contains hijacks in real
> time, publishes free advisories to cited.md to get discovered, and earns x402
> payments for audits. An autonomous security service on the open web. Four sponsor
> tools, one pipeline. Agents defending agents — and getting paid for it."**

---

## If a judge asks…

- **"Did the model actually get hijacked?"** → "No — and that's the point. Modern
  Claude resisted it; you saw it flag the attack. The vulnerability is the harness
  trusting untrusted text as control flow — a confused-deputy bug, the root cause of
  most real agent incidents. AgentSOC defends regardless of *why* an agent goes rogue."
- **"Is the payment real?"** → "The x402 protocol is fully real — real 402 challenge,
  real signed EIP-3009 payment, real verify/settle. On-chain settlement is simulated
  by default so the demo needs no funded wallet; one env var flips it to live Base
  Sepolia."
- **"Is cited.md real?"** → "Yes — published live via the Senso CLI. Here's the URL,
  open it on your phone."
- **"What's Guild's role?"** → "The real action trail and the containment surface. We
  read `guild session events`; we contain with credential-deny / workspace-remove.
  Their governance primitives became our security tools."

## Backup
If anything flakes live, the bulletproof fallback is `npm run pay-demo` (zero setup),
and you should screen-record one clean GUI run beforehand as a tape.
