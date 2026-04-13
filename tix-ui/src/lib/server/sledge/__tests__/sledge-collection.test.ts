import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTicketLedger, type Ticket } from "../ticket-ledger";
import { createSledgeTicketCollection } from "../sledge-collection";

describe("Sledge → TanStack DB Collection", () => {
  let db: Database.Database;
  let ledger: ReturnType<typeof createTicketLedger>;
  let controller: AbortController;
  let cleanups: Array<() => void>;

  beforeEach(() => {
    db = new Database(":memory:");
    ledger = createTicketLedger(db);
    controller = new AbortController();
    cleanups = [];
  });

  afterEach(async () => {
    for (const fn of cleanups) fn();
    controller.abort();
    await ledger.close();
    db.close();
  });

  /** Subscribe to activate sync (TanStack DB collections are lazy — need a subscriber) */
  function activate(collection: ReturnType<typeof createSledgeTicketCollection>) {
    const sub = collection.subscribeChanges(() => {});
    cleanups.push(() => sub.unsubscribe());
    return collection;
  }

  const makeTicket = (id: string, title: string): Ticket => ({
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
  });

  it("collection loads initial tickets from Sledge", async () => {
    await ledger.emit("ticket.created", makeTicket("t01", "First ticket"));
    await ledger.emit("ticket.created", makeTicket("t02", "Second ticket"));

    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);

    expect(collection.state.size).toBe(2);
    expect(collection.state.get("t01")?.title).toBe("First ticket");
    expect(collection.state.get("t02")?.title).toBe("Second ticket");
  });

  it("collection receives new ticket via tail", async () => {
    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);
    expect(collection.state.size).toBe(0);

    await ledger.emit("ticket.created", makeTicket("t03", "Tailed ticket"));

    await waitFor(() => collection.state.size === 1);
    expect(collection.state.get("t03")?.title).toBe("Tailed ticket");
  });

  it("collection receives updates via tail", async () => {
    await ledger.emit("ticket.created", makeTicket("t04", "Update me"));

    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);
    expect(collection.state.get("t04")?.status).toBe("open");

    await ledger.emit("ticket.updated", { id: "t04", status: "done" });

    await waitFor(() => collection.state.get("t04")?.status === "done");
    expect(collection.state.get("t04")?.status).toBe("done");
  });

  it("collection receives deletes via tail", async () => {
    await ledger.emit("ticket.created", makeTicket("t05", "Delete me"));

    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);
    expect(collection.state.size).toBe(1);

    await ledger.emit("ticket.deleted", { id: "t05" });

    await waitFor(() => collection.state.size === 0);
    expect(collection.state.size).toBe(0);
  });

  it("write-back: collection.insert → Sledge event", async () => {
    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);

    collection.insert(makeTicket("t06", "From TanStack"));

    await waitFor(async () => {
      const t = await ledger.query("ticketById", { id: "t06" });
      return t !== null;
    });

    const ticket = (await ledger.query("ticketById", { id: "t06" })) as Ticket;
    expect(ticket.title).toBe("From TanStack");
  });

  it("write-back: collection.update → Sledge event", async () => {
    await ledger.emit("ticket.created", makeTicket("t07", "Update via DB"));

    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);

    collection.update("t07", (item) => { item.status = "done"; });

    await waitFor(async () => {
      const t = (await ledger.query("ticketById", { id: "t07" })) as Ticket | null;
      return t?.status === "done";
    });

    const ticket = (await ledger.query("ticketById", { id: "t07" })) as Ticket;
    expect(ticket.status).toBe("done");
  });

  it("write-back: collection.delete → Sledge event", async () => {
    await ledger.emit("ticket.created", makeTicket("t08", "Delete via DB"));

    const collection = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    await waitForReady(collection);

    collection.delete("t08");

    await waitFor(async () => {
      const t = await ledger.query("ticketById", { id: "t08" });
      return t === null;
    });

    const ticket = await ledger.query("ticketById", { id: "t08" });
    expect(ticket).toBeNull();
  });
});

// --- Helpers ---

function waitForReady(collection: { status: string }, timeout = 5000): Promise<void> {
  return waitFor(() => collection.status === "ready", timeout);
}

async function waitFor(
  condition: (() => boolean) | (() => Promise<boolean>),
  timeout = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = condition();
    const met = result instanceof Promise ? await result : result;
    if (met) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}
