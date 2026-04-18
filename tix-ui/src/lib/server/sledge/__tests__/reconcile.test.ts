import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTicketLedger, type Ticket } from "../ticket-ledger";
import { reconcile } from "../sync";

function makeTicket(id: string, title: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title,
    status: "open",
    type: "feature",
    priority: 2,
    tags: [],
    deps: [],
    assignee: "",
    body: "",
    filename: `${title} (${id}).md`,
    folder: "",
    created: new Date().toISOString(),
    ...overrides,
  };
}

function writeTicketFile(ticketsDir: string, ticket: Ticket): string {
  const full = path.join(ticketsDir, ticket.filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const fm = [
    "---",
    `id: "${ticket.id}"`,
    `title: ${ticket.title}`,
    `status: ${ticket.status}`,
    `type: ${ticket.type}`,
    `priority: ${ticket.priority}`,
    `assignee: ""`,
    `tags: []`,
    `deps: []`,
    `created: '${ticket.created}'`,
    "---",
    ticket.body,
    "",
  ].join("\n");
  fs.writeFileSync(full, fm);
  return full;
}

describe("reconcile", () => {
  let db: InstanceType<typeof Database>;
  let ledger: ReturnType<typeof createTicketLedger>;
  let ticketsDir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    ledger = createTicketLedger(db);
    ticketsDir = fs.mkdtempSync(path.join(os.tmpdir(), "tix-reconcile-"));
  });

  afterEach(async () => {
    await ledger.close();
    db.close();
    fs.rmSync(ticketsDir, { recursive: true, force: true });
  });

  it("relocates DB row instead of re-projecting when .md file moved to a subfolder", async () => {
    const ticket = makeTicket("a1b2", "Moved Ticket");
    await ledger.emit("ticket.created", ticket);

    // Simulate: user moved the file externally (while app was down) to a subfolder.
    const moved = {
      ...ticket,
      filename: "archive/2026-04-03/Moved Ticket (a1b2).md",
      folder: "archive/2026-04-03",
    };
    writeTicketFile(ticketsDir, moved);

    const result = await reconcile(ledger, ticketsDir);

    expect(result.projected).toBe(0);
    expect(result.ingested).toBe(0);

    // DB row should now reflect the new location.
    const updated = (await ledger.query("ticketById", { id: "a1b2" })) as Ticket;
    expect(updated.filename).toBe("archive/2026-04-03/Moved Ticket (a1b2).md");
    expect(updated.folder).toBe("archive/2026-04-03");

    // No stale duplicate at root.
    expect(fs.existsSync(path.join(ticketsDir, "Moved Ticket (a1b2).md"))).toBe(false);
  });

  it("re-projects when DB row's file is missing and no file with that id exists anywhere", async () => {
    const ticket = makeTicket("c3d4", "Orphan Ticket");
    await ledger.emit("ticket.created", ticket);

    const result = await reconcile(ledger, ticketsDir);

    expect(result.projected).toBe(1);
    expect(fs.existsSync(path.join(ticketsDir, "Orphan Ticket (c3d4).md"))).toBe(true);
  });

  it("ingests files on disk missing from the DB", async () => {
    const disk = makeTicket("e5f6", "Disk Ticket");
    writeTicketFile(ticketsDir, disk);

    const result = await reconcile(ledger, ticketsDir);

    expect(result.ingested).toBe(1);
    const got = (await ledger.query("ticketById", { id: "e5f6" })) as Ticket;
    expect(got.title).toBe("Disk Ticket");
  });
});
