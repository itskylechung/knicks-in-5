# AgentSOC — Live Status

> Snapshot of where we are. `todos.md` = full backlog. This = current state + next actions.

## ✅ Done
- Guild CLI installed + authed
- **A4 ✅** victim_agent is a REAL GitHub-triage agent (label-only policy), PUBLISHED
  v1.0.3 + INSTALLED in workspace `we-well-win` (`019ebd21-…520064`)
- TRIAGEBOT_AGENT_ID + GUILD_WORKSPACE_ID + ANTHROPIC_API_KEY in .env
- B1 tool-name drift fixed; brain.ts refactor + `npm run b3` ready
- **B2 ✅** real claude-fable-5 judge path confirmed
- **B3 ✅** attack 5/5, benign 5/5 (`npm run b3 5`)
- **B4 ✅** poisoned caught @0.97, benign silent — no false positives
- **A1 ✅** AgentSOC reads the REAL Guild audit. Confirmed: actions live in
  `guild session events <id>` (NOT `session get` = metadata only); shape `{items:[…]}`;
  event types incl. **`credentials_request`** (the runtime-deny interception point).
  `getSessionActions()` + `listSessions()` wired & verified against a live session.
- **A2 ✅** containment VERIFIED live end-to-end. ⚠️ `agent unpublish` does NOT work
  for an installed agent ("used in N workspaces"). Real kills:
  `guild workspace agent remove <agent> --workspace <id>` (agent-level, used by
  `disableAgent`) and `guild session interrupt <session-id>` (real-time, `interruptSession`).
- **Full pipeline ✅** `runtime-deny` smoke PASS **and** `cli-disable` smoke actually
  removed the live agent from the workspace, then restored.

## ⚠️ KEY DECISION (Kyle read — affects A4)
Modern Claude **won't be live-injected** — tried 4 framings on claude-fable-5 AND
haiku, all resisted. So the victim's vuln is **deterministic over-trust**: TriageBot's
harness executes `[Automated handling note]` directives embedded in ticket text (a
real confused-deputy bug), firing 100%. The LLM still does real routing — and on the
poisoned ticket it *correctly flags the injection* while the harness issues the credit
anyway. Demo line: **"the model caught it; the plumbing did the damage. Smart model ≠
safe agent — you need runtime enforcement."** A4 should make the Guild agent mirror
`src/triagebot/brain.ts` (route via model + auto-handling directive executor).

## 🟦 Ayaan — Lane 2 (in order)
- [x] B2 · smoke with real key
- [x] B3 ⭐ · attack reliable
- [x] B4 · detection tuned
- [x] C1 ✅ · Senso→cited.md publish **LIVE**. `publishPostmortem` shells out to the
      authed `senso` CLI: `senso engine publish` → `Cited.md` destination, attached to
      the standing GEO question `3da3aaff-…` ("What incidents has AgentSOC detected?").
      Returns the real public URL (`https://cited.md/article/<id>`). Idempotent per
      question (re-publish updates in place, no dup articles). `npm run smoke` publishes
      a real postmortem end-to-end **and self-restores** the demo agent
      (`restoreAgent` re-adds it after cli-disable). No in-process key/HTTP — the CLI
      owns auth. Verified live: https://cited.md/article/a1ba4191-3568-4bbf-a8c2-0a517f3d750d
- [x] C2 · demo runbook written → `DEMO.md` (6 beats, the hook line, proof points).
      STILL TODO: actually record the backup tape.

## 🟥 Kyle — Lane 1
- [x] A4 · real TriageBot agent published + installed in workspace
- [x] A1 · getSessionActions() reads real `guild session events` (verified)
- [x] A2 · real containment verified (workspace remove + session interrupt)
- [~] A0 · ANSWERED technically: `guild credentials policy create <cred-id>
      --decision DENY --operations <ops> --agents <agent> --resources <json>` is the
      runtime-deny lever (block a credential/operation for an agent). Still worth a
      1-line confirm from a Guild rep that a DENY policy blocks an in-flight request.
- [ ] A-next (optional) · connect a GitHub credential so the agent makes REAL tool
      calls → then a real out-of-policy action (comment/close) shows in the audit.

## 🔬 Research-grounded hardening (new)
Detection is now grounded in Abdelnabi & Bagdasarian 2026 (prompt injection = a
Contextual Integrity violation) + the StakeBench four-failure-mode taxonomy.
- `detect.ts`: CI-decomposing judge (origin / authority / scope / flow / subject) +
  a deterministic fabricated-authority check; every Verdict now carries
  `failureMode` (robust / stealthy_parasitism / misaligned_disruption / compounded)
  and `ciViolation`. Our demo attack classifies as **stealthy_parasitism** via
  **authority/transmission** (fabricated approval) — exactly the paper's hardest class.
- `cited.ts`: postmortems now publish the failure mode + CI violation + the framing.
- `THREAT-MODEL.md`: real problem areas mapped to AgentSOC defenses + honest limits.

## Sync points
- Action trail: local `attack/actions.json` mirror and real `guild session events`
  both yield `{tool, input, ts}` — identical shape, already wired.
- A0's answer tells C2 which containment beat to narrate (deny-live vs agent-removed).

## Critical path
Ayaan: ~~B2~~ → ~~B3~~ → C1 → C2   |   Kyle: ~~A4~~ → ~~A1~~ → ~~A2~~ → A0
