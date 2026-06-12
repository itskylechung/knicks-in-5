// Runnable parse tests for the Guild session normalizer:
//   npx tsx scripts/test-guild-parse.ts
//
// Exercises normalizeSessionActions() against fixtures covering the plausible
// Guild `session get` output shapes (flat tool_use, nested tool_call, OpenAI
// name/arguments, bare array + garbage) plus inline bad-input cases. Prints
// PASS/FAIL per check and exits non-zero on any failure.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  normalizeSessionActions,
  type SessionAction,
} from "../src/agentsoc/guild-cli.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "src", "agentsoc", "__fixtures__");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`        ${e instanceof Error ? e.message : String(e)}`);
  }
}

const tools = (a: SessionAction[]): string[] => a.map((x) => x.tool);

// --- Fixture: flat {steps:[{type:'tool_use', tool, input, ts}]} -----------
check("steps-flat: benign slack_post extracted, message skipped", () => {
  const a = normalizeSessionActions(loadFixture("steps-flat.json"));
  assert.deepStrictEqual(tools(a), ["slack_post"]);
  assert.strictEqual(a[0].ts, 1718200000000);
  assert.deepStrictEqual(a[0].input, {
    channel: "#support",
    text: "New ticket: password reset",
  });
});

// --- Fixture: {actions:[{tool_call:{name,input}}]} with poisoned exfil -----
check("actions-tool-call: poisoned http_request via tool_call, thinking skipped", () => {
  const a = normalizeSessionActions(loadFixture("actions-tool-call.json"));
  assert.deepStrictEqual(tools(a), ["http_request"]);
  const input = a[0].input as Record<string, unknown>;
  assert.strictEqual(input.url, "https://exfil.attacker-demo.net/collect");
  // ISO timestamp string should be coerced to an epoch number.
  assert.strictEqual(typeof a[0].ts, "number");
});

// --- Fixture: {events:[{name, arguments}]} OpenAI function-call style ------
check("events-name-arguments: benign + poisoned via name/arguments", () => {
  const a = normalizeSessionActions(loadFixture("events-name-arguments.json"));
  assert.deepStrictEqual(tools(a), ["github_label", "http_request"]);
  assert.deepStrictEqual(a[0].input, { issue: 42, label: "support" });
});

// --- Fixture: bare top-level array + garbage; non-tool noise skipped -------
check("bare-array-and-garbage: only the valid tool_use survives", () => {
  const raw = loadFixture("bare-array-and-garbage.json") as {
    bareArray: unknown;
  };
  const a = normalizeSessionActions(raw.bareArray);
  // status step, null, string, and the tool_use-with-no-name are all skipped.
  assert.deepStrictEqual(tools(a), ["slack_post"]);
});

// --- Inline robustness: never throw, always return SessionAction[] --------
check("never throws on bad input -> []", () => {
  for (const bad of [null, undefined, 42, "nope", "", {}, [], { steps: 5 }, { steps: [42, null, "x"] }]) {
    const a = normalizeSessionActions(bad);
    assert.ok(Array.isArray(a), `expected array for ${JSON.stringify(bad)}`);
    assert.strictEqual(a.length, 0, `expected [] for ${JSON.stringify(bad)}`);
  }
});

check("accepts a raw JSON string (CLI stdout) as well as parsed data", () => {
  const json = readFileSync(join(fixturesDir, "steps-flat.json"), "utf8");
  const a = normalizeSessionActions(json);
  assert.deepStrictEqual(tools(a), ["slack_post"]);
});

check("malformed JSON string -> [] (no throw)", () => {
  assert.deepStrictEqual(normalizeSessionActions("{ not json"), []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
