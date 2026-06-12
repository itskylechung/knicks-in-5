# Guild Containment Feasibility (ticket A0)

Research-only. Question: can Guild AI's agent credential-request flow
(`guild_credentials_request`) be **intercepted before execution** — by an approval
webhook, a policy hook, or another agent — to enable the **runtime-deny** (block-live)
containment path? If not, **cli-disable** (detect, then disable the agent via CLI) is the
fallback.

All findings below are from Guild's **public docs as of 2026-06-12**. The docs are thin on
the exact governance mechanics, so several answers are deliberately marked UNCONFIRMED.
Treat every "VENUE TODO" as a question to settle in the first 30 minutes on-site.

---

## ★ LIVE CLI VERIFICATION — `guild v0.12.3` (installed on this machine)

We have a real `guild` binary (`/opt/homebrew/bin/guild`, v0.12.3). Probing `--help` (read-only,
no auth needed) confirmed the command surface and **corrected/added** several things vs. the
docs-only research below. Folded into `src/agentsoc/guild-cli.ts`.

**Confirmed & corrected:**
- **JSON flag is GLOBAL `--mode json`** (`interactive`|`json`|`jsonl`), *not* a per-command
  `--json`. The repo stub used `--json` — **fixed** to `guild --mode json session get <id>`.
- **`guild session`**: `list | get <id> | events <id> | tasks <id> | create | send <id> | interrupt <id>`.
- **No `guild agent disable`/`pause`** (research was right). Real agent off-switch = `agent unpublish <id>`.
  `disableAgent()` candidate list trimmed to the one real command.

**New findings the docs-only pass missed — both improve our options:**
1. **`guild session interrupt <session-id>` — "Interrupt a running session."** This directly
   answers research Q6: we *can* stop an in-flight hijacked run, not just prevent new ones. It
   needs the **session id** (not agent id), so it's a caller-level change (AgentSOC must track the
   live session) — the cleaner kill for the demo than `agent unpublish`.
2. **`guild credentials policy {create|update|delete} <credential-id>`** — a **programmatic
   credential-policy** mechanism (plus `credentials endpoint list`). The docs-only research found
   only `credentials endpoint` and concluded runtime-deny was "leaning NO." This **upgrades
   runtime-deny to PLAUSIBLE**: AgentSOC could `credentials policy create` a deny/restrict policy
   on the abused credential when it detects compromise. It's policy-based (not proven to be a
   live per-request veto), so still confirm at the venue whether a newly-created policy is enforced
   **pre-execution** on the in-flight request — but the lever exists and is scriptable.
3. **`guild mcp`** starts Guild as an **MCP server over stdio**. Alternative integration: AgentSOC
   could read sessions / drive containment over MCP (structured) instead of parsing CLI stdout.

**Revised containment recommendation:** keep `cli-disable` as the safe default, but the strongest
*offline-buildable* "deny" story is now **detect → `guild session interrupt <session-id>`** (kill
the run) **+ optionally `guild credentials policy create`** (revoke the abused credential). Confirm
at the venue whether the policy applies to the in-flight call; if yes, that's the real runtime-deny.

**Still need the venue for:** the actual `session get`/`events` JSON body shape (needs auth + a
live session — `--mode json` errored only on missing session arg, command itself is valid), and
whether `session events` follows/streams (A5).

---

## (a) Verdict

| Question | Verdict | Confidence |
|---|---|---|
| **runtime-deny feasible** (intercept/deny a hijacked `guild_credentials_request` before it runs, via a *third party* — webhook/policy/another agent) | **UNCONFIRMED, leaning NO** | medium |
| **cli-disable feasible** (detect deviation, then disable/contain the agent via CLI) | **YES (with one gap to confirm)** | medium-high |
| **live-tail of session events** (react instantly instead of polling) | **YES, very likely** — `guild session events` is documented as "Stream session events" | medium-high |

**Why "UNCONFIRMED, leaning NO" for runtime-deny:**

The credential flow *does* have a native suspend-and-approve gate, but as documented it is a
**human-in-the-loop self-gate**, not a *third-party interception* point:

- `guild_credentials_request` is described as a **hook tool** that **suspends the agent**
  while **the user completes an OAuth flow** for the requested service. The flow is:
  agent asks → *the user* is prompted to connect/authorize → execution resumes. (Sources below.)
- The SDK surface is `task.guild.credentials_request({ service })` — "Ask **the user** to
  authorize a third-party service." The resolver is **the user who owns the session**, and the
  parameter is a *service name* (e.g. `github`, `linear`), **not a scoped action** we can
  selectively deny.
- Guild's "human approval" gate ("The agent proposes. A human approves. The control plane
  enforces the boundary.") is real and is the closest primitive to runtime-deny — **but** every
  description has the *human session owner* as the approver. There is **no documented webhook,
  policy hook, or agent-callable API that lets a *different* agent (AgentSOC) approve/deny that
  request on the human's behalf.**
- **Triggers are start-only.** Guild's only event-driven primitive (`guild trigger`, webhook +
  time) *starts* an agent from an **external service** event (Slack/GitHub/Jira/Linear/...). The
  docs give **no** trigger that fires on **internal** events (a tool call, a credential request)
  and **no** mechanism for a trigger to **gate/veto** an action mid-run. So "another agent
  intercepts the cred request" is **not supported by triggers**.

So the *machinery to block a request live exists* (the cred request genuinely suspends), but the
**only documented party that can resolve it is the human session owner** — not our defender
agent, not a webhook, not a policy rule keyed on tool/scope. Until a Guild rep confirms a
third-party / programmatic approval resolver, **runtime-deny is not confirmed buildable**.

---

## (b) Evidence (with sources)

**Credential request is a suspend-on-user-approval hook (the central fact):**
- Tool sets doc: `guild_credentials_request` is a **hook tool** — "User completes an OAuth flow
  for a third-party service"; it **suspends execution**, runtime persists state, resumes via
  `onToolResults` / automatic resumption.
  https://docs.guild.ai/sdk/tools.md
- Task object doc: `task.guild.credentials_request({ service })` — "Ask **the user** to authorize
  a third-party service (e.g., Linear, GitHub)"; "may **suspend the agent** while waiting for a
  user … to respond." Resolver = the user; argument = `service`, not a scope/action.
  https://docs.guild.ai/sdk/task-object.md
- Credentials platform doc: agent requests a credential → "**The user is prompted to connect** the
  service before the agent continues." No approval/denial/policy-hook/webhook mechanics documented.
  https://docs.guild.ai/platform/credentials.md

**Human-approval gate exists, but approver = human session owner (not a third agent/webhook):**
- "The agent proposes. A human approves. The control plane enforces the boundary." / "No agent
  executes a high-risk action without explicit approval."
  https://www.guild.ai/platform/govern
- LLM Gateway mediates **every LLM call** to "intercept requests to enforce rate limits, apply
  content policies, track tokens, rotate credentials." This is **platform-internal interception**,
  not an external hook we can drive, and it gates *LLM calls*, not *tool/credential execution*.
  https://www.guild.ai/platform/govern

**Triggers are start-only, external-event-only (rules out agent-intercepts-agent):**
- Two trigger types: **Webhook** (external service events) and **Time** (schedule). Webhook events
  are external (Slack `app_mention`/`message`, GitHub `pull_request`/`issues`/`push`, Linear,
  Jira, …). Triggers "**run an agent automatically**" — they *start*, they do not gate or fire on
  internal tool/credential events.
  https://docs.guild.ai/platform/triggers.md

**CLI surface (what cli-disable + live-tail will lean on):**
- `guild session list`, `guild session get <id>`, **`guild session events <id>` — "Stream session
  events"**, `guild session tasks`, `guild session send <id> <msg>`.
  https://docs.guild.ai/cli/commands.md
- Agent management: `guild agent ...` incl. `update`, `publish`, `unpublish`, `versions`, `get`,
  `list`, `create`, `clone`. **No documented `guild agent disable`/`stop`/`deactivate`.** Closest
  documented "off switch" is **`guild agent unpublish`** (and possibly `update`, though no
  status/enabled flag is documented). `guild workspace agent remove` can detach an agent from a
  workspace. **Trigger-level kill is documented: `guild trigger deactivate`** — if the victim is
  driven by a trigger, deactivating the trigger stops new runs.
  https://docs.guild.ai/cli/commands.md
- Session audit trail is read via CLI (`session get`/`events`); SDK package is
  **`@guildai/agents-sdk`**. No public REST endpoint for reading the audit log or mutating agent
  scope is documented — CLI remains the integration seam (matches repo README).
  https://docs.guild.ai/packages/agents-sdk.md , https://docs.guild.ai/platform/sessions.md

**Sessions / streaming / SIEM:**
- Sessions are "logged end-to-end (inputs, tool calls, decisions)," multi-turn sessions stay open
  for real-time back-and-forth, and `guild session events` **streams** events. Marketing claims
  logs "stream directly to enterprise SIEM" and are "visible in real time," but the **docs do not
  specify** the stream transport (SSE/websocket), flags (`--follow`/`--since`), or a SIEM export
  config. So live-tail is **very likely** but the exact mechanism is unconfirmed.
  https://docs.guild.ai/platform/sessions.md , https://www.guild.ai/platform/govern

---

## (c) Exact venue questions to confirm it

Runtime-deny (the make-or-break ones):
1. Can a party **other than the human session owner** resolve a `guild_credentials_request`
   suspension — i.e. can **another agent or a webhook programmatically approve OR DENY** it? If
   yes: what's the API/endpoint, and does a denial cleanly fail the tool call?
2. Is there a **policy hook / pre-execution callback** that fires **before a tool or credential
   request executes**, keyed on `{tool, scope, target}`, that can return allow/deny? (The
   "control plane enforces the boundary" claim — is that human-only, or programmable?)
3. Can a **credential's scope be denied/revoked at runtime** (per action/endpoint) so the
   hijacked `http_request`/exfil call fails even though the agent is "authorized" for the service?
4. Does the LLM-Gateway "content policy" mediation expose a **customer-writable rule** that could
   block an outbound tool/credential request live? (vs. internal-only.)

cli-disable (fallback hardening):
5. What is the real **"kill the agent" command**? Confirm whether it's `guild agent unpublish`,
   a `guild agent update --status/--disabled`, `guild workspace agent remove`, and/or
   `guild trigger deactivate`. (Repo's `disableAgent()` currently tries 3 candidates — confirm
   which one actually stops an in-flight/next run.)
6. Does disabling stop an **already-running** session, or only prevent new ones? If only new ones,
   is `guild session send` (or a cancel) able to interrupt the live run?

Live-tail (A5):
7. Does `guild session events <id>` **block and follow** (long-lived stream) or return a snapshot?
   Any `--follow`/`--since`/`--json` flags? What transport (SSE/websocket) and event schema?
8. Real JSON shape of `session get` / `session events` events (tool name, input, ts) — to fix the
   remap in `getSessionActions()` in one place.

---

## (d) Default CONTAINMENT_MODE given current evidence

**Default to `cli-disable`.** (This already matches `src/config.ts`:
`containmentMode = process.env.CONTAINMENT_MODE ?? "cli-disable"`.)

Rationale: runtime-deny depends on a third-party-resolvable / policy-hook interception that the
public docs **do not confirm**, while detect-then-disable rests only on the **documented** CLI
(`session get`/`events` in, an agent/trigger off-switch out) and is the safer guaranteed demo.
Keep runtime-deny behind the env flag so that **if** venue question (1) or (2) comes back YES, the
switch to `CONTAINMENT_MODE=runtime-deny` is a one-line change at `contain.ts` with no rebuild —
exactly the fork the README describes. Do **not** present runtime-deny as confirmed in the demo
narration unless a Guild rep validates it on-site.

---

## (e) Live-tail finding (for ticket A5)

**Finding: YES, live-tail is very likely available** via **`guild session events <session-id>`**,
documented literally as **"Stream session events."** Combined with multi-turn sessions being
real-time and Guild's "visible in real time" / "stream to SIEM" claims, AgentSOC can plausibly
**react to TriageBot's tool calls on a live stream instead of polling every 3s**.

Caveats / unconfirmed (resolve via venue Q7–Q8 before relying on it):
- The docs show **no flags** (`--follow`, `--since`, `--json`) and **don't state the transport**
  (is it a blocking SSE/websocket stream, or a one-shot dump?). "Stream" in the command summary is
  suggestive but not proof of a long-lived follow.
- The **event schema is unknown** (same unknown that affects `getSessionActions()` parsing).

A5 recommendation: build the watch loop so the telemetry source is swappable —
**poll `guild session get` by default (guaranteed), with an opt-in "tail" path that consumes
`guild session events` as a stream.** If Q7 confirms it follows, flip AgentSOC to the tail path
for instant reaction; if not, polling still wins the demo. Keep both behind the same
`SessionAction[]` contract so nothing downstream changes.

---

## VENUE TODOs (carry into code as comments)

- **VENUE TODO (A0/contain.ts):** confirm a third-party/programmatic approve-or-DENY resolver for
  `guild_credentials_request`, or a pre-execution policy hook. If absent, runtime-deny is not
  buildable — stay on cli-disable.
- **VENUE TODO (guild-cli.ts `disableAgent`):** confirm the real off-switch among
  `guild agent unpublish` / `guild agent update` / `guild workspace agent remove` /
  `guild trigger deactivate`; confirm it stops an in-flight run.
- **VENUE TODO (A5/index.ts):** confirm `guild session events` follows (streams) vs. snapshots;
  capture its flags + event JSON schema; wire the tail path or keep polling.
- **VENUE TODO (getSessionActions):** capture real `session get`/`events` JSON to fix the remap in
  one place.
