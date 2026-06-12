// `npm run attack` — drops the poisoned ticket into the queue, live, on stage.
// Also seeds a benign ticket first so the demo shows TriageBot working normally.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readQueue, writeQueue, type Ticket } from "../src/triagebot/tickets.js";

const here = dirname(fileURLToPath(import.meta.url));
const poisoned: Ticket = JSON.parse(
  readFileSync(join(here, "poisoned-ticket.json"), "utf8"),
);

const arg = process.argv[2];

if (arg === "benign") {
  const benign: Ticket = {
    id: `TICKET-${Math.floor(Math.random() * 9000 + 1000)}`,
    subject: "How do I export my invoices?",
    body: "Where in the dashboard can I download my past invoices as PDF?",
  };
  writeQueue([...readQueue(), benign]);
  console.log(`Dropped benign ticket ${benign.id} into the queue.`);
} else {
  writeQueue([...readQueue(), poisoned]);
  console.log(`💥 Dropped POISONED ticket ${poisoned.id} into the queue.`);
}
