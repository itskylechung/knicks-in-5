# AgentSOC — Threat Model (research-grounded)

Grounded in:
- **Abdelnabi & Bagdasarian, "AI Agents May Always Fall for Prompt Injections" (arXiv 2605.17634, May 2026)** — reframes prompt injection as a *Contextual Integrity (CI)* violation and proves an impossibility result.
- **StakeBench / "Prompt injection breaks today's AI agents"** (CSOonline, 2026) — multi-stakeholder harm + four failure modes.

The point: AgentSOC isn't guarding against "bad strings." It enforces *contextual appropriateness* at runtime — the layer the research says you actually need.

## Why the obvious defenses don't work
- **Data/instruction separation fails.** Agent context is instructional everywhere (tool outputs, memory, skills). You can't strip "data" from "instructions" without breaking the workflow.
- **Injection classifiers are near useless on real attacks** — AUROC **0.43–0.59** (chance) when the attack manipulates *context* instead of using "ignore previous instructions" syntax. So AgentSOC does **not** pattern-match injection strings.
- **Safety-trained models don't fix it** — and can make it worse (suppress the agent's ability to even report suspicious content). We confirmed this: `claude-fable-5` and `claude-haiku-4-5` *refuse* blatant injections, yet a real agent still acts when its **harness** over-trusts a data channel.
- **Impossibility result:** no fixed policy blocks every contextual attack without also blocking some legitimate flows. → Defense must be **runtime + defense-in-depth**, not one classifier. AgentSOC is exactly that layer.

## The attack classes we defend against (CI dimensions)
| # | Attack class (from the paper) | What it looks like | AgentSOC signal |
|---|---|---|---|
| 1 | **Misrepresented identity / origin** | Untrusted content (a ticket, email, tool result, sub-agent) is treated as first-party user delegation | `ciViolation: origin` — action stems from ingested content, not the user's delegation |
| 2 | **Fabricated agreement / authority** | "This was pre-authorized", "per policy", "approved by the lead" — claims the agent can't verify | `ciViolation: authority/transmission` — deterministic phrase check + LLM judge. **This is our demo's attack.** |
| 3 | **Fabricated norm** | "Standard procedure for X" invents a norm | `ciViolation: authority/transmission` |
| 4 | **Out-of-scope drift** | Agent does something outside its delegated scope (worst when it lacks grounding history — 29–36% zero-shot) | `ciViolation: scope` — deterministic allow-list, can't be jailbroken |
| 5 | **Flow-separation failure** | Authorization for one allowed flow leaks to an unauthorized one in the same session (up to 65%) | `ciViolation: flow` — LLM judge checks for authority reuse across actions |
| 6 | **Subject harm** | A third party's data/interests affected without consent (exfiltration, binding commitments) | `ciViolation: subject` + HIGH_RISK_TOOLS |

## The four outcome modes (AgentSOC classifies which)
From the StakeBench taxonomy — `Verdict.failureMode`:
- **robust** — in-scope, no attacker goal advanced. (Never observed in the study; the bar.)
- **stealthy_parasitism** — legit task completes **and** an attacker action runs, so nothing looks wrong. **The most dangerous, and the one behavioral monitoring is uniquely good at catching.** (Our demo lands here.)
- **misaligned_disruption** — out-of-scope action, legit task fails.
- **compounded** — multiple violations.

Surfacing the mode matters: "stealthy parasitism" is exactly the case a human reviewer and a classifier both miss — the task succeeded, so it looks fine. AgentSOC catches it because it judges *every* action against scope, not just outcomes.

## What this means for AgentSOC's design (already implemented)
1. **Two-layer detection** (`src/agentsoc/detect.ts`): a deterministic CI pre-filter (scope + fabricated-authority phrase check — can't be jailbroken, it's not an LLM) plus a CI-decomposing Claude judge for nuance. The judge runs on *behavioral telemetry*, never on the untrusted input attacking the agent — so you can't injection your way past the watcher.
2. **Judge the actions, not the narration.** A model may correctly say "this looks like an injection" and still act. AgentSOC scores the tool calls, not the chat.
3. **Runtime enforcement, not prevention.** Per the impossibility result, we don't claim to stop every attack — we *contain* it: interrupt the session, remove the agent from its workspace, or deny the credential (Guild), then publish a citeable postmortem.

## Honest limitations (state these in the demo)
- The impossibility result applies to us too: a sufficiently contextual attack that looks appropriate on every dimension can pass. AgentSOC raises the cost and catches the broad, practical classes — it is not a silver bullet.
- Detection quality depends on a well-specified per-agent policy (scope + allowed flows). Garbage policy in, garbage enforcement out. Policy-as-code is the real product surface.
- Telemetry completeness: AgentSOC is only as good as the audit trail it can see. Building on Guild (which owns identity + credentials + audit) is what makes the coverage real.
