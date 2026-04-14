import { Type, type Static } from "@sinclair/typebox";
import { defineLedgerModel } from "@torkbot/sledge/ledger";
import { createBetterSqliteLedger } from "@torkbot/sledge/better-sqlite3-ledger";
import {
  SystemRuntimeClock,
  NodeRuntimeScheduler,
} from "@torkbot/sledge/runtime/node-runtime";
import type Database from "better-sqlite3";

// -- Schemas --

const TicketSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  status: Type.String(),
  type: Type.String(),
  priority: Type.Number(),
  tags: Type.Array(Type.String()),
  deps: Type.Array(Type.String()),
  links: Type.Array(Type.String()),
  assignee: Type.String(),
  body: Type.String(),
  filename: Type.String(),
  folder: Type.String(),
  created: Type.String(),
});

export type Ticket = Static<typeof TicketSchema>;

const TicketUpdateSchema = Type.Object({
  id: Type.String(),
  title: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Number()),
  tags: Type.Optional(Type.Array(Type.String())),
  deps: Type.Optional(Type.Array(Type.String())),
  links: Type.Optional(Type.Array(Type.String())),
  assignee: Type.Optional(Type.String()),
  body: Type.Optional(Type.String()),
  filename: Type.Optional(Type.String()),
  folder: Type.Optional(Type.String()),
  created: Type.Optional(Type.String()),
});

const TicketIdSchema = Type.Object({ id: Type.String() });

// -- Projection table setup --

function ensureProjectionTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      type TEXT NOT NULL DEFAULT 'feature',
      priority INTEGER NOT NULL DEFAULT 2,
      tags TEXT NOT NULL DEFAULT '[]',
      deps TEXT NOT NULL DEFAULT '[]',
      links TEXT NOT NULL DEFAULT '[]',
      assignee TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      filename TEXT NOT NULL DEFAULT '',
      folder TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    )
  `);
}

// -- Model definition --

const model = defineLedgerModel({
  events: {
    "ticket.created": TicketSchema,
    "ticket.updated": TicketUpdateSchema,
    "ticket.deleted": TicketIdSchema,
  },
  queues: {},
  indexers: {
    upsertTicket: TicketSchema,
    patchTicket: TicketUpdateSchema,
    deleteTicket: TicketIdSchema,
  },
  queries: {
    ticketById: {
      params: TicketIdSchema,
      result: Type.Union([Type.Null(), TicketSchema]),
    },
    allTickets: {
      params: Type.Object({}),
      result: Type.Array(TicketSchema),
    },
    search: {
      params: Type.Object({ query: Type.String(), limit: Type.Optional(Type.Number()) }),
      result: Type.Array(TicketSchema),
    },
    folderCounts: {
      params: Type.Object({}),
      result: Type.Array(Type.Object({ folder: Type.String(), count: Type.Number() })),
    },
  },
  register(builder) {
    builder.project("ticket.created", async ({ event, actions }) => {
      await actions.index("upsertTicket", event.payload);
    });
    builder.project("ticket.updated", async ({ event, actions }) => {
      await actions.index("patchTicket", event.payload);
    });
    builder.project("ticket.deleted", async ({ event, actions }) => {
      await actions.index("deleteTicket", event.payload);
    });
  },
});

// -- Factory --

export function createTicketLedger(db: Database.Database) {
  ensureProjectionTable(db);

  const boundModel = model.bind({
    indexers: {
      upsertTicket: async (input) => {
        db.prepare(`
          INSERT OR REPLACE INTO tickets (id, title, status, type, priority, tags, deps, links, assignee, body, filename, folder, created, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          input.id,
          input.title,
          input.status,
          input.type,
          input.priority,
          JSON.stringify(input.tags),
          JSON.stringify(input.deps),
          JSON.stringify(input.links),
          input.assignee,
          input.body,
          input.filename,
          input.folder,
          input.created,
        );
      },
      patchTicket: async (input) => {
        const ALLOWED_COLUMNS = new Set([
          "title", "status", "type", "priority", "tags", "deps", "links",
          "assignee", "body", "filename", "folder", "created",
        ]);

        const existing = db
          .prepare("SELECT * FROM tickets WHERE id = ?")
          .get(input.id) as Record<string, unknown> | undefined;
        if (!existing) return;

        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [key, val] of Object.entries(input)) {
          if (key === "id" || val === undefined) continue;
          if (!ALLOWED_COLUMNS.has(key)) continue;
          updates.push(`${key} = ?`);
          values.push(
            Array.isArray(val) ? JSON.stringify(val) : val,
          );
        }
        if (updates.length === 0) return;
        updates.push("updated_at = datetime('now')");
        values.push(input.id);
        db.prepare(
          `UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`,
        ).run(...values);
      },
      deleteTicket: async (input) => {
        db.prepare("DELETE FROM tickets WHERE id = ?").run(input.id);
      },
    },
    queries: {
      ticketById: async (params) => {
        const row = db
          .prepare("SELECT * FROM tickets WHERE id = ?")
          .get(params.id) as Record<string, unknown> | undefined;
        if (!row) return null;
        return rowToTicket(row);
      },
      allTickets: async () => {
        const rows = db
          .prepare("SELECT * FROM tickets ORDER BY priority ASC")
          .all() as Record<string, unknown>[];
        return rows.map(rowToTicket);
      },
      search: async (params) => {
        const q = `%${params.query}%`;
        const limit = params.limit ?? 50;
        const rows = db
          .prepare(
            `SELECT * FROM tickets WHERE
              title LIKE ? OR body LIKE ? OR tags LIKE ? OR assignee LIKE ? OR id LIKE ?
            ORDER BY priority ASC LIMIT ?`,
          )
          .all(q, q, q, q, q, limit) as Record<string, unknown>[];
        return rows.map(rowToTicket);
      },
      folderCounts: async () => {
        const rows = db
          .prepare(
            "SELECT folder, COUNT(*) as count FROM tickets GROUP BY folder ORDER BY folder",
          )
          .all() as Array<{ folder: string; count: number }>;
        return rows;
      },
    },
  });

  return createBetterSqliteLedger({
    database: db,
    boundModel,
    timing: {
      clock: new SystemRuntimeClock(),
      scheduler: new NodeRuntimeScheduler(),
    },
  });
}

function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
    type: row.type as string,
    priority: row.priority as number,
    tags: JSON.parse(row.tags as string),
    deps: JSON.parse(row.deps as string),
    links: JSON.parse(row.links as string),
    assignee: row.assignee as string,
    body: row.body as string,
    filename: row.filename as string,
    folder: row.folder as string,
    created: row.created as string,
  };
}
