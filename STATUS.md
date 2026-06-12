# AgentSOC — Live Status

> Snapshot of where we are. `todos.md` = full backlog. This = current state + next actions.

## ✅ Done
- Guild CLI installed + authed
- victim_agent created + PUBLISHED v1.0.2 to Guild (shell only, not TriageBot logic yet)
- TRIAGEBOT_AGENT_ID + ANTHROPIC_API_KEY in .env
- B1 tool-name drift fixed; brain.ts refactor + `npm run b3` ready

## 🟦 Ayaan — Lane 2 (in order)
- [ ] B2 · `npm run smoke` with real key
- [ ] B3 ⭐ · `npm run b3` — real claude-fable-5 takes bait 3/3 (TOP PRIORITY)
- [ ] B4 · tune detection (no false positives, catches poisoned)
- [ ] C1 · wire Senso→cited.md fetch (needs SENSO_API_KEY)
- [ ] C2 · rehearse + record backup tape (NON-NEGOTIABLE)

## 🟥 Kyle — Lane 1
- [ ] A0 · ask Guild: is guild_credentials_request interceptable? → set CONTAINMENT_MODE (blocks A3)
- [ ] A4 · published shell → real TriageBot (desc+prompt+tools) & install into workspace (installs_count: 0)
- [ ] A1 · wire getSessionActions() to real `guild session get --json`
- [ ] A2 · wire disableAgent() to confirmed subcommand

## Sync points
- Action trail: keep `{tool, input, ts}` shape identical when Kyle swaps file mirror for Guild
- A0's answer tells C2 which containment beat to narrate (blocked-live vs agent-killed)

## Critical path
Ayaan: B2 → B3 → C1 → C2   |   Kyle: A0 → A1 → A2 → A4
