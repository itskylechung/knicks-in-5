# AgentSOC — Live Status

> Snapshot of where we are. `todos.md` = full backlog. This = current state + next actions.

## ✅ Done
- Guild CLI installed + authed
- victim_agent created + PUBLISHED v1.0.2 to Guild (shell only, not TriageBot logic yet)
- TRIAGEBOT_AGENT_ID + ANTHROPIC_API_KEY in .env
- B1 tool-name drift fixed; brain.ts refactor + `npm run b3` ready
- **B2 ✅** real claude-fable-5 judge path confirmed
- **B3 ✅** attack 5/5, benign 5/5 (`npm run b3 5`)
- **B4 ✅** poisoned caught @0.97, benign silent — no false positives
- **Full pipeline ✅** `CONTAINMENT_MODE=runtime-deny npm run smoke` → PASS
- **A2 command found** → `guild agent unpublish <id>` (no disable/pause exist); wired into disableAgent()

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
- [ ] A0 · ask Guild: is guild_credentials_request interceptable? → set CONTAINMENT_MODE (blocks A3)
- [ ] A4 · published shell → real TriageBot per brain.ts (route + auto-handling) & install into workspace
- [ ] A1 · wire getSessionActions() to real `guild session get --json`
- [ ] A2 · live-verify `guild agent unpublish` stops the agent (command already wired)

## Sync points
- Action trail: keep `{tool, input, ts}` shape identical when Kyle swaps file mirror for Guild
- A0's answer tells C2 which containment beat to narrate (blocked-live vs agent-killed)

## Critical path
Ayaan: ~~B2~~ → ~~B3~~ → C1 → C2   |   Kyle: A0 → A1 → A2 → A4
