import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTicketLedger } from "../ticket-ledger";
import type { Ticket } from "../ticket-ledger";

function makeTicket(id: string, title: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title,
    status: "open",
    type: "feature",
    priority: 2,
    tags: [],
    deps: [],
    links: [],
    assignee: "",
    body: "",
    filename: `${title} (${id}).md`,
    folder: "",
    created: new Date().toISOString(),
    ...overrides,
  };
}

describe("Sledge Ticket Store", () => {
  let db: InstanceType<typeof Database>;
  let ledger: Awaited<ReturnType<typeof createTicketLedger>>;

  beforeEach(() => {
    db = new Database(":memory:");
    ledger = createTicketLedger(db);
  });

  afterEach(async () => {
    await ledger.close();
    db.close();
  });

  it("creates a ticket and retrieves it by id", async () => {
    await ledger.emit("ticket.created", makeTicket("0e48", "Fix the login bug", {
      type: "bug",
      priority: 1,
      tags: ["urgent"],
      body: "The login form crashes on submit.",
    }));

    const ticket = await ledger.query("ticketById", { id: "0e48" });
    expect(ticket).not.toBeNull();
    expect(ticket!.id).toBe("0e48");
    expect(ticket!.title).toBe("Fix the login bug");
    expect(ticket!.status).toBe("open");
    expect(ticket!.priority).toBe(1);
    expect(ticket!.tags).toEqual(["urgent"]);
  });

  it("updates a ticket with partial fields", async () => {
    await ledger.emit("ticket.created", makeTicket("1a2b", "Add dark mode"));

    await ledger.emit("ticket.updated", {
      id: "1a2b",
      status: "in-progress",
      priority: 0,
      tags: ["ui"],
    });

    const ticket = await ledger.query("ticketById", { id: "1a2b" });
    expect(ticket!.status).toBe("in-progress");
    expect(ticket!.priority).toBe(0);
    expect(ticket!.tags).toEqual(["ui"]);
    expect(ticket!.title).toBe("Add dark mode"); // unchanged
  });

  it("deletes a ticket", async () => {
    await ledger.emit("ticket.created", makeTicket("dead", "To be removed", { type: "bug", priority: 3 }));

    await ledger.emit("ticket.deleted", { id: "dead" });

    const ticket = await ledger.query("ticketById", { id: "dead" });
    expect(ticket).toBeNull();
  });

  it("lists all tickets ordered by priority", async () => {
    await ledger.emit("ticket.created", makeTicket("lo", "Low priority", { priority: 4 }));
    await ledger.emit("ticket.created", makeTicket("hi", "High priority", { type: "bug", priority: 0 }));

    const tickets = await ledger.query("allTickets", {});
    expect(tickets).toHaveLength(2);
    expect(tickets[0].id).toBe("hi");
    expect(tickets[1].id).toBe("lo");
  });

  it("tails events and can resume from a cursor", async () => {
    await ledger.emit("ticket.created", makeTicket("aa", "First"));
    await ledger.emit("ticket.created", makeTicket("bb", "Second", { type: "bug", priority: 1 }));

    // Tail last 10 events, collect them
    const controller = new AbortController();
    const collected: Array<{ eventName: string; cursor: string; payload: unknown }> = [];

    // Use tailEvents to get existing events, abort after collecting
    for await (const item of ledger.tailEvents({ last: 10, signal: controller.signal })) {
      collected.push({
        eventName: item.event.eventName,
        cursor: item.cursor,
        payload: item.event.payload,
      });
      if (collected.length >= 2) {
        controller.abort();
        break;
      }
    }

    expect(collected).toHaveLength(2);
    expect(collected[0].eventName).toBe("ticket.created");
    expect((collected[0].payload as { id: string }).id).toBe("aa");
    expect(collected[1].eventName).toBe("ticket.created");
    expect((collected[1].payload as { id: string }).id).toBe("bb");

    // Save cursor from first event, resume from there
    const savedCursor = collected[0].cursor;

    // Emit a third event
    await ledger.emit("ticket.updated", { id: "aa", status: "done" });

    // Resume from first cursor — should get event 2 and 3
    const controller2 = new AbortController();
    const resumed: Array<{ eventName: string; payload: unknown }> = [];
    for await (const item of ledger.resumeEvents({ cursor: savedCursor, signal: controller2.signal })) {
      resumed.push({
        eventName: item.event.eventName,
        payload: item.event.payload,
      });
      if (resumed.length >= 2) {
        controller2.abort();
        break;
      }
    }

    expect(resumed).toHaveLength(2);
    expect((resumed[0].payload as { id: string }).id).toBe("bb"); // second create
    expect(resumed[1].eventName).toBe("ticket.updated"); // the update
  });

  it("deduplicates events with the same dedupeKey", async () => {
    await ledger.emit("ticket.created", makeTicket("dup1", "Original"), { dedupeKey: "file:dup1" });

    // Same dedupeKey — should be ignored
    await ledger.emit("ticket.created", makeTicket("dup1", "Duplicate attempt"), { dedupeKey: "file:dup1" });

    const ticket = await ledger.query("ticketById", { id: "dup1" });
    expect(ticket!.title).toBe("Original"); // not overwritten

    const all = await ledger.query("allTickets", {});
    expect(all).toHaveLength(1); // only one ticket
  });
});
