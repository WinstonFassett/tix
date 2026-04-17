import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { eq, createLiveQueryCollection } from "@tanstack/db";
import { createTicketLedger, type Ticket } from "../ticket-ledger";
import { createSledgeTicketCollection } from "../sledge-collection";

describe("TanStack DB Live Query over Sledge Collection", () => {
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

  function activate<T extends { subscribeChanges: (...args: any[]) => any }>(collection: T) {
    const sub = collection.subscribeChanges(() => {});
    cleanups.push(() => sub.unsubscribe());
    return collection;
  }

  const makeTicket = (id: string, title: string, overrides: Partial<Ticket> = {}): Ticket => ({
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
  });

  it("live query filters open tickets from Sledge-backed collection", async () => {
    await ledger.emit("ticket.created", makeTicket("t1", "Fix bug", { status: "open", type: "bug" }));
    await ledger.emit("ticket.created", makeTicket("t2", "Done task", { status: "done" }));
    await ledger.emit("ticket.created", makeTicket("t3", "Feature", { status: "open" }));

    const source = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    const live = activate(
      createLiveQueryCollection((q) =>
        q.from({ tickets: source })
          .where(({ tickets }) => eq(tickets.status, "open"))
          .select(({ tickets }) => ({ id: tickets.id, title: tickets.title })),
      ),
    );

    await waitForReady(live);

    const items = [...live.state.values()];
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title).sort()).toEqual(["Feature", "Fix bug"]);
  });

  it("live query updates incrementally when Sledge emits new event", async () => {
    await ledger.emit("ticket.created", makeTicket("t1", "Existing", { status: "open" }));

    const source = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    const live = activate(
      createLiveQueryCollection((q) =>
        q.from({ tickets: source })
          .where(({ tickets }) => eq(tickets.status, "open"))
          .select(({ tickets }) => ({ id: tickets.id, title: tickets.title })),
      ),
    );

    await waitForReady(live);
    expect(live.state.size).toBe(1);

    // Sledge emits a new open ticket — live query should pick it up
    await ledger.emit("ticket.created", makeTicket("t2", "New arrival", { status: "open" }));

    await waitFor(() => live.state.size === 2);
    expect(live.state.size).toBe(2);
    expect([...live.state.values()].map((i) => i.title).sort()).toEqual(["Existing", "New arrival"]);
  });

  it("live query removes item when ticket status changes to done", async () => {
    await ledger.emit("ticket.created", makeTicket("t1", "Will close", { status: "open" }));
    await ledger.emit("ticket.created", makeTicket("t2", "Stays open", { status: "open" }));

    const source = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    const live = activate(
      createLiveQueryCollection((q) =>
        q.from({ tickets: source })
          .where(({ tickets }) => eq(tickets.status, "open"))
          .select(({ tickets }) => ({ id: tickets.id, title: tickets.title })),
      ),
    );

    await waitForReady(live);
    expect(live.state.size).toBe(2);

    // Close t1 via Sledge
    await ledger.emit("ticket.updated", { id: "t1", status: "done" });

    await waitFor(() => live.state.size === 1);
    expect([...live.state.values()][0].title).toBe("Stays open");
  });

  it("live query with orderBy sorts by priority", async () => {
    await ledger.emit("ticket.created", makeTicket("t1", "Low", { priority: 4 }));
    await ledger.emit("ticket.created", makeTicket("t2", "High", { priority: 1 }));
    await ledger.emit("ticket.created", makeTicket("t3", "Medium", { priority: 2 }));

    const source = activate(
      createSledgeTicketCollection({ ledger, signal: controller.signal }),
    );

    const live = activate(
      createLiveQueryCollection((q) =>
        q.from({ tickets: source })
          .select(({ tickets }) => ({
            id: tickets.id,
            title: tickets.title,
            priority: tickets.priority,
          }))
          .orderBy(({ tickets }) => tickets.priority, "asc"),
      ),
    );

    await waitForReady(live);

    const titles = [...live.state.values()].map((i) => i.title);
    expect(titles).toEqual(["High", "Medium", "Low"]);
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
