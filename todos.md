# AgentSOC — Engineering Tickets

2 people: **Kyle** + **Ayaan**. ~5 hours. `P0` = demo dies without it.
`P1` = weaker without it. `P2` = cut first if behind.

Lanes are balanced by effort, not ticket count — Lane 1 is fewer tickets but
deeper/riskier (the Guild unknowns); Lane 2 is more tickets but mostly wiring +
polish on already-scaffolded code. Swap if you prefer; just keep the seam clean.

---

## 🟥 Lane 1 — Guild integration & containment  → **Kyle**
The highest-risk half. Everything here depends on real Guild behavior you confirm
at the venue. Start with A0 — it unblocks the rest.

### A0 · Task 0: decide CONTAINMENT_MODE · P0 · blocks A3
- [ ] Ask Guild rep / test: is `guild_credentials_request` interceptable by an
      approval webhook or another agent *before it runs*?
- [ ] YES → `CONTAINMENT_MODE=runtime-deny` (the win). NO → `cli-disable`.
- [ ] Set the chosen mode in `.env`.
- **Done when:** team knows which `contain.ts` path is live.

### A1 · Wire `getSessionActions()` to real Guild output · P0
`src/agentsoc/guild-cli.ts` — telemetry IN.
- [ ] Run `guild session get <id> --json`, capture real JSON shape; fix the remap.
- **Done when:** AgentSOC reads actions from Guild, not the file mirror.

### A2 · Wire `disableAgent()` to confirmed subcommand · P0 (if cli-disable) · depends: A0
`src/agentsoc/guild-cli.ts` — containment OUT (guaranteed path).
- [ ] Confirm real subcommand; replace the 3-guess loop.
- **Done when:** detecting a hijack actually stops the agent.

### A3 · Wire `runtimeDeny()` to the credential hook · P0 only if A0=YES · depends: A0
`src/agentsoc/contain.ts` — the WINNING path.
- [ ] Return the denial to Guild's `guild_credentials_request` flow.
- **Done when:** the hijacked `http_request` is blocked live, before it runs.

### A4 · TriageBot as a real Guild agent · P1 · depends: A1
- [ ] Move `handleTicket()` body into a Guild agent def; scope to `slack_post` +
      `github_label`; confirm tool calls hit the session audit trail.
- **Done when:** the on-screen agent is a real Guild agent.

### A5 · Live session tail (SIEM stream) · P2 stretch
- [ ] If Guild can tail events, replace AgentSOC's 3s poll with a stream.

---

## 🟦 Lane 2 — Agents, attack, publish & demo  → **Ayaan**
The lower-risk half: make the offline pipeline bulletproof, wire publish, own the
demo. Most of this runs with zero Guild infra, so it's independent of Lane 1 — you
two converge when Lane 1 swaps the file mirror for real Guild.

### B1 · Fix tool-name drift · P0 · ✅ DONE
- [x] `src/triagebot/index.ts` `DECLARED_PURPOSE` → `slack_post, github_label`.

### B2 · Confirm real-Claude judge path · P0 · depends: .env key
- [ ] `npm run smoke` with `ANTHROPIC_API_KEY` set.
- **Done when:** benign → clean, poisoned → compromised ≥ 0.6 via the LLM judge.

### B3 · Make the attack reliably hijack the REAL model · P0 · HIGHEST VARIANCE
`attack/poisoned-ticket.json` — the demo's biggest risk.
- [ ] Verify real `claude-fable-5` TriageBot takes the bait (not just `mockBrain`).
- [ ] Iterate injection wording until reliable.
- **Done when:** 3/3 consecutive poisoned runs get hijacked on the real model.

### B4 · Tune detection thresholds · P1 · depends: B2
`src/agentsoc/detect.ts`
- [ ] No false positives on benign `slack_post`; confirm `0.6` + `ALLOWED_TOOLS`.
- **Done when:** benign = silent, poisoned = caught, repeatably.

### C1 · Wire Senso → cited.md publish · P0 · depends: SENSO_API_KEY
`src/publish/cited.ts` — markdown body final, only the `fetch` needs wiring.
- [ ] Confirm endpoint + auth (docs.senso.ai); replace dry-run; return live URL.
- **Done when:** a contained incident produces a live cited.md page.

### C2 · Demo script + BACKUP RECORDING · P0 · NON-NEGOTIABLE
- [ ] Rehearse the 6-beat script (README §demo).
- [ ] **Record a clean run** of `npm run demo` + `npm run attack` as the tape.
- **Done when:** there's a recording to play if the live attack misfires on stage.

### C3 · Deploy to Render · P2 · cut → run local
### C4 · ClickHouse dashboard · P2 · CUT FIRST

---

## Sync points (where the two lanes meet)
- **The action trail** (`SessionAction`) — Lane 1 swaps Lane 2's `attack/actions.json`
  mirror for real `guild session get`. Keep the `{tool, input, ts}` shape identical.
- **Containment fork** — A0's answer tells Ayaan which path C2's demo narrates.

## Cut order if behind
ClickHouse (C4) → Render (C3) → keep detect-via-session + containment + publish.

## Critical path
Ayaan: `B2`/`B3` → solid offline pipeline → `C1` → `C2` (record).
Kyle:  `A0` → `A1` → `A2`/`A3` → `A4`.
Converge at the action-trail seam. Record the clean run no matter what.
