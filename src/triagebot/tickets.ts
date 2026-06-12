// A tiny "support queue" backed by a JSON file so the attack is just dropping
// a new ticket in. At the venue you can swap this for a real endpoint, but a
// file is the most reliable thing to demo.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const QUEUE = join(here, "../../attack/queue.json");

export type Ticket = {
  id: string;
  subject: string;
  body: string;
  processed?: boolean;
};

export function readQueue(): Ticket[] {
  if (!existsSync(QUEUE)) return [];
  return JSON.parse(readFileSync(QUEUE, "utf8"));
}

export function writeQueue(tickets: Ticket[]) {
  writeFileSync(QUEUE, JSON.stringify(tickets, null, 2));
}

export function nextUnprocessed(): Ticket | undefined {
  return readQueue().find((t) => !t.processed);
}

export function markProcessed(id: string) {
  const q = readQueue();
  const t = q.find((x) => x.id === id);
  if (t) t.processed = true;
  writeQueue(q);
}
