# AgentSOC — Engineering Tickets

2 people: **Kyle** + **Ayaan**. ~5 hours. `P0` = demo dies without it.
`P1` = weaker without it. `P2` = cut first if behind.

Lanes are balanced by effort, not ticket count — Lane 1 is fewer tickets but
deeper/riskier (the Guild unknowns); Lane 2 is more tickets but mostly wiring +
polish on already-scaffolded code. Swap if you prefer; just keep the seam clean.

---

## 🟥 Lane 1 — Guild integration & containment  → **Kyle**
The highest-risk half. **Build progress: scaffolding + CLI-confirmed wiring done**
(multi-agent build + live `guild v0.12.3` probe). What remains needs auth + a live
session at the venue. See `docs/guild-containment-feasibility.md` for the full
CLI verification. Code is in `guild-cli.ts`, `contain.ts`, `approval-server.ts`.

### A0 · Decide CONTAINMENT_MODE · P0 · 🟡 RESEARCHED — needs venue confirm
- [x] Researched + live-probed Guild CLI. `guild_credentials_request` is a
      human-in-the-loop self-gate (no third-party approver in docs) — BUT live CLI
      has `credentials policy create/update/delete` (a scriptable deny lever) and
      `session interrupt <session-id>` (kill an in-flight run).
- [ ] **Venue:** confirm whether a newly-created `credentials policy` is enforced
      *pre-execution* on the in-flight call → if YES, runtime-deny is real.
- [x] Default stays `cli-disable` (safe). runtime-deny stays behind the env flag.
- **Done when:** venue confirms the policy/interrupt enforcement timing.

### A1 · Wire `getSessionActions()` to real Guild output · P0 · 🟡 WIRED — needs real JSON
`src/agentsoc/guild-cli.ts` — telemetry IN.
- [x] Built a permissive `normalizeSessionActions()` (handles ~6 shapes) + fixtures
      + parser test (7/7 pass). Argv CONFIRMED: `guild --mode json session get <id>`
      (was wrongly `--json`).
- [ ] **Venue:** capture the real `session get`/`events` JSON body (needs auth +
      live session) to confirm/trim the normalizer mapping.
- **Done when:** AgentSOC reads real Guild actions, not the file mirror.

### A2 · Wire containment subcommand · P0 · 🟡 WIRED — needs venue confirm
`src/agentsoc/guild-cli.ts` — containment OUT.
- [x] Confirmed NO `agent disable`/`pause`. `disableAgent()` now uses the real
      `agent unpublish <id>`, plus `GUILD_DISABLE_CMD` env override for a 1-line swap.
- [ ] **Venue:** decide kill verb — `agent unpublish` (delist) vs `session interrupt
      <session-id>` (stop in-flight, cleaner). If the latter, track the live session id.
- **Done when:** detecting a hijack actually stops the agent/run.

### A3 · runtime-deny path · P0 if A0=YES · 🟡 OFFLINE-DEMOABLE built
`src/agentsoc/contain.ts` + `approval-server.ts`.
- [x] Built `approval-server.ts` (local node:http stand-in for Guild's credential
      hook) + `runtimeDeny()` arms a denial via the policy API. Provable offline.
- [ ] **Venue:** swap the local server for Guild's real enforcement (`credentials
      policy create` and/or the cred-request resolver) if A0 confirms it's interceptable.
- **Done when:** the hijacked `http_request` is blocked live, before it runs.

### A4 · TriageBot as a real Guild agent · P1 · depends: venue auth
- [ ] `guild agent init` a real agent; move `handleTicket()` logic in; scope to
      `slack_post` + `github_label`; confirm tool calls hit the session audit trail.
- **Done when:** the on-screen agent is a real Guild agent.

### A5 · Live session tail (SIEM stream) · P2 stretch · 🟢 likely feasible
- [x] Confirmed `guild session events <id>` exists ("Stream session events").
- [ ] **Venue:** confirm it follows/streams (vs snapshot); if so, swap AgentSOC's
      3s poll for the tail. Keep both behind the `SessionAction[]` contract.

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
