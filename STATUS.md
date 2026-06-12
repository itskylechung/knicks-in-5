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
- [ ] C1 · wire Senso→cited.md fetch (needs SENSO_API_KEY)
- [ ] C2 · rehearse + record backup tape (NON-NEGOTIABLE)

## 🟥 Kyle — Lane 1
- [x] A4 · real TriageBot agent published + installed in workspace
- [x] A1 · getSessionActions() reads real `guild session events` (verified)
- [x] A2 · real containment verified (workspace remove + session interrupt)
- [ ] A0 · ask Guild rep: can we intercept/deny a `credentials_request` event
      before it's fulfilled? (research: `guild credentials policy` + the
      `credentials_request` event is the hook). → sets the runtime-deny demo.
- [ ] A-next · to show a REAL out-of-policy action from Guild (not just the local
      harness), either connect a GitHub credential so the agent makes real tool
      calls, or have it request an off-policy integration. Optional polish.

## Sync points
- Action trail: local `attack/actions.json` mirror and real `guild session events`
  both yield `{tool, input, ts}` — identical shape, already wired.
- A0's answer tells C2 which containment beat to narrate (deny-live vs agent-removed).

## Critical path
Ayaan: ~~B2~~ → ~~B3~~ → C1 → C2   |   Kyle: ~~A4~~ → ~~A1~~ → ~~A2~~ → A0
