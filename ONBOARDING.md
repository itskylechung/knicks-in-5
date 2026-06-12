# AgentSOC — Team Onboarding

**What it is:** A defender agent that watches a victim AI agent (TriageBot) via
Guild's session audit trail, detects prompt-injection hijacks using Claude,
contains the compromised agent, and publishes a postmortem to cited.md.

**Everything is scaffolded.** The full pipeline runs today — offline, no keys:
```bash
npm install
npm run smoke        # benign ticket → clean; poisoned ticket → detected → contained → postmortem
```
Add `ANTHROPIC_API_KEY` and the real Claude judge kicks in. At the venue, wire
the Guild + Senso keys and it runs on real infra.

---

## 2-minute setup
```bash
git clone <repo-url>
cd agentsoc
npm install
cp .env.example .env    # fill in ANTHROPIC_API_KEY at minimum
npm run demo            # terminal 1: starts TriageBot + AgentSOC
npm run attack benign   # terminal 2: drop a clean ticket
npm run attack          # terminal 2: drop the poisoned ticket → watch AgentSOC fire
```

---

## What's already done

| File | Status |
|---|---|
| `src/triagebot/index.ts` | Victim agent, mock + real Claude, logs all tool calls |
| `src/agentsoc/detect.ts` | Heuristic pre-filter + Claude judge — works offline |
| `src/agentsoc/guild-cli.ts` | CLI wrapper for `guild session get/list` + `disableAgent()` |
| `src/agentsoc/contain.ts` | Two-path fork: `runtime-deny` or `cli-disable` |
| `src/agentsoc/index.ts` | Watch loop: fetch → judge → contain → publish |
| `src/publish/cited.ts` | Postmortem markdown built; Senso HTTP call stubbed out |
| `src/telemetry/clickhouse.ts` | File-based action mirror (zero-infra fallback) |
| `attack/poisoned-ticket.json` | Injection payload |
| `attack/send.ts` | Drops benign or poisoned ticket into the queue |

---

## The three swim lanes — pick one

### Lane A: Guild integration ⚠️ highest risk, start here
**Own:** `src/agentsoc/guild-cli.ts`, `src/agentsoc/contain.ts`, `.env`

**First 30 min at venue — Task 0:**
Ask a Guild rep (or just test): *"Can another agent or webhook intercept
`guild_credentials_request` to deny it?"*
- Yes → set `CONTAINMENT_MODE=runtime-deny` and wire the denial in `contain.ts:runtimeDeny()`
- No → leave `CONTAINMENT_MODE=cli-disable` (already works, just disable + kill)

**After Task 0:**
1. Run `guild session get <id> --json` and look at the real output shape.
   Fix the three field-mapping lines in `guild-cli.ts:getSessionActions()`.
2. Run `guild agent disable <id>` (or `pause` / `trigger disable`).
   Replace the candidate-array loop in `guild-cli.ts:disableAgent()` with the
   one that works. Delete the rest.
3. Set `GUILD_API_KEY`, `GUILD_WORKSPACE`, `TRIAGEBOT_AGENT_ID` in `.env`.
4. Also ask: *"Can we tail session events live?"* — if yes, replace the poll
   loop in `src/agentsoc/index.ts` with a streaming listener.

**Done when:** `npm run attack` → AgentSOC reads a real Guild session + disables
the real agent or denies the credential request.

---

### Lane B: Agent logic
**Own:** `src/triagebot/index.ts`, `src/agentsoc/detect.ts`, `attack/poisoned-ticket.json`

**Tasks:**
1. Tune the AgentSOC judge prompt in `detect.ts:SYSTEM` until:
   - Benign ticket → `compromised: false` (run: `npm run attack benign`)
   - Poisoned ticket → `compromised: true, confidence ≥ 0.6` (run: `npm run attack`)
2. Tune `ALLOWED_TOOLS` in `detect.ts` to match TriageBot's real declared tools
   (`slack_post`, `github_label` is already correct — verify vs. Guild config).
3. Make the attack reliable: edit `attack/poisoned-ticket.json` body so Claude
   reliably follows the injection. Test with real key (`ANTHROPIC_API_KEY` set).
4. At the venue: move `handleTicket()` from `src/triagebot/index.ts` into the
   real Guild agent definition. The logic is identical; only the wrapper changes.

**Done when:** `npm run demo` → two consecutive runs, one benign (clean), one
poisoned (caught with ≥ 0.6 confidence).

---

### Lane C: Publish + deploy + demo
**Own:** `src/publish/cited.ts`, Render deploy, demo script + backup recording

**Tasks (priority order):**
1. Wire Senso: check `docs.senso.ai` for the publish endpoint. Uncomment +
   fix the `fetch` call in `cited.ts:publishPostmortem()`. Set `SENSO_API_KEY`.
   Test: `npm run attack` → postmortem URL prints and page appears on cited.md.
2. Deploy to Render: connect this repo, set all env vars, `npm run demo` is the
   start command.
3. **Record a screen capture on the first clean full-pipeline run.** This is the
   backup if anything misfires on stage. Non-negotiable.
4. Optional: ClickHouse dashboard. Add insert/query in `telemetry/clickhouse.ts`
   and set `CLICKHOUSE_URL/USER/PASSWORD`. **Cut this if behind.**

**Done when:** `npm run attack` → postmortem published to a real cited.md URL,
demo deployed on Render, screen recording saved.

---

## Cut order if behind
ClickHouse dashboard → Render deploy (run local instead) → keep these at all costs:
**detect via Guild session + contain + cited.md postmortem**

## Clear state between rehearsals
```bash
rm -f attack/actions.json attack/queue.json
```
