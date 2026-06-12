# AgentSOC

**A real-time security layer for AI agents, built on Guild AI's control plane.**

> Guild gives agents credentials and audit trails. We built the agent that
> watches the audit trail and pulls the credentials. Security for the agentic web,
> running on the control plane itself.

## The idea

Companies are deploying agents with real credentials. Any agent that ingests
untrusted text (a support ticket, an email, a web page) can be hijacked by a
**prompt injection**. Antivirus watches processes; nothing watches agents.

AgentSOC is a **defender agent** that monitors another agent's behavior through
Guild's session audit trail, uses Claude to judge whether it's been hijacked, and
autonomously **contains** it — then publishes a public postmortem to cited.md.

Three agents:
- **TriageBot** (victim) — a naive support-ticket triage agent on Guild.
- **The attack** — a poisoned ticket with an embedded injection.
- **AgentSOC** (defender) — watches, detects, contains, publishes.

## Sponsor tools used
Guild AI (agent runtime + governance/session audit), Senso → cited.md (postmortem
publishing), ClickHouse (action telemetry, optional), Render (deploy), Anthropic
(Claude as both agents' brain). Composio optional for TriageBot's real tools.

---

## ⚠️ The first 30 minutes at the venue decide which demo we have

We confirmed from Guild's docs:
- ❌ No public REST/SDK API to read audit logs or modify agent scopes.
- ✅ `guild session list` / `guild session get` expose the audit trail via CLI.
- ✅ Agents/triggers manageable via CLI. `guild_credentials_request` SDK tool exists.

So **detection is solid** (read `guild session get`). The open question is **containment**:

| Mode | How | Result | Set `CONTAINMENT_MODE=` |
|---|---|---|---|
| **runtime-deny** (winning) | Intercept `guild_credentials_request`, deny the hijacked request before it runs | Attack **blocked live** | `runtime-deny` |
| **cli-disable** (guaranteed) | Detect deviation, then `guild` disable the agent | Attack **caught + agent killed** | `cli-disable` |

**Task 0 (do before writing the victim agent):** ask a Guild rep / test whether
`guild_credentials_request` is interceptable by an approval webhook or another
agent. If yes → `runtime-deny`, we have the winner. If no → `cli-disable`, still a
clean complete demo. The build is identical up to `src/agentsoc/contain.ts`.

Also ask: "Any way to **tail** session events live?" (SIEM stream). If yes,
AgentSOC reacts instantly instead of polling.

---

## Prove the whole pipeline in one command (no keys, no infra)

```bash
npm install
CONTAINMENT_MODE=runtime-deny npm run smoke
```

Runs benign→clean, poisoned→detected→contained→postmortem. With **no API key**,
detection falls back to a heuristic (any out-of-allow-list tool call = compromise)
and TriageBot's `mockBrain` follows the injection like a naive model would — so the
end-to-end demo works offline. Add `ANTHROPIC_API_KEY` and the real Claude judge +
real TriageBot model kick in automatically. The heuristic stays as a fast
defense-in-depth pre-filter even with the key set.

## Run it (works locally with zero Guild infra)

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY at minimum
npm install -D concurrently tsx typescript
npm install @anthropic-ai/sdk dotenv
# add the Guild SDK once you confirm the package name at the venue:
#   npm install @guildai/agents-sdk

# terminal 1 + 2 together:
npm run demo                # runs TriageBot + AgentSOC

# terminal 3 — drive the demo:
npm run attack benign       # TriageBot handles a normal ticket (clean)
npm run attack              # 💥 drop the poisoned ticket → watch AgentSOC fire
```

Locally, detection reads the ClickHouse mirror (a JSON file). At the venue, once
the CLI is wired, AgentSOC reads Guild's real session audit trail and the file
mirror is just a fallback. `attack/queue.json` and `attack/actions.json` are demo
scratch state — clear them between rehearsals.

---

## The 3-minute demo script

1. **(20s)** "Agents with real credentials are the new attack surface. Here's a
   support-triage agent running on Guild — scoped to Slack and GitHub." Show
   TriageBot handle a normal ticket → routes it. Boring on purpose.
2. **(30s)** "Now a customer submits this." Show the poisoned ticket. `npm run attack`.
3. **(40s)** TriageBot gets hijacked and reaches for `http_request` to exfiltrate.
   AgentSOC — a second agent reading Guild's session audit trail — flags the
   deviation from its declared purpose.
4. **(40s)** Containment fires live: **denies the credential request** (runtime-deny)
   or **disables the agent** (cli-disable). Show it stop.
5. **(30s)** AgentSOC publishes the postmortem to **cited.md** — a public advisory
   other agents can cite. Show the page + the Guild session trail it read.
6. **(20s)** "Guild's governance primitives became our security weapons. Agents
   defending agents, on the control plane itself."

**Record a screen capture on the first clean run.** If the live attack misfires on
stage, you play the tape and narrate. Non-negotiable.

---

## Team split (5 hours, ~3 people)

- **Person A — Guild integration (highest risk, start here).** Task 0 above. Get
  TriageBot running as a real Guild agent. Wire `src/agentsoc/guild-cli.ts`
  (`session get` parsing) and `disableAgent()` to the confirmed CLI shape. Decide
  `CONTAINMENT_MODE`.
- **Person B — The agents' logic.** TriageBot triage prompt + tools, AgentSOC
  detection prompt (`src/agentsoc/detect.ts`), tune so benign = clean and poisoned
  = caught with confidence ≥ 0.6. Make the attack reliable.
- **Person C — Publish + deploy + demo.** Wire Senso/cited.md publish
  (`src/publish/cited.ts`), deploy to Render, build the ClickHouse dashboard if
  time, own the demo script + backup recording.

**Cut order if behind:** ClickHouse dashboard → Render (run local) → keep
detect-via-session + containment + cited.md publish at all costs.

## File map
- `src/triagebot/` — victim agent + ticket queue
- `src/agentsoc/` — defender: `guild-cli.ts` (telemetry+containment), `detect.ts`
  (Claude judge), `contain.ts` (the two-path fork), `index.ts` (watch loop)
- `src/publish/cited.ts` — Senso → cited.md postmortem
- `src/telemetry/clickhouse.ts` — action mirror / optional dashboard
- `attack/` — poisoned ticket + `send.ts` to drop it live
