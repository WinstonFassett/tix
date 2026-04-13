/**
 * TanStack DB collection adapter for Sledge.
 *
 * Feeds Sledge events into a TanStack DB collection via the
 * begin/write/commit sync interface. Write-back mutations
 * go through Sledge's ledger.emit().
 */
import { createCollection } from "@tanstack/db";
import type { Ticket, createTicketLedger } from "./ticket-ledger";

type Ledger = ReturnType<typeof createTicketLedger>;

export interface SledgeCollectionOptions {
  ledger: Ledger;
  /** AbortSignal to stop the tail loop */
  signal?: AbortSignal;
}

export function createSledgeTicketCollection(options: SledgeCollectionOptions) {
  const { ledger, signal } = options;

  const collection = createCollection<Ticket, string>({
    id: "tickets",
    getKey: (ticket) => ticket.id,

    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        let lastCursor = 0;

        // Initial load: fetch all tickets from Sledge's projection table
        const init = async () => {
          const tickets = (await ledger.query("allTickets", {})) as Ticket[];
          begin();
          for (const ticket of tickets) {
            write({ type: "insert", value: ticket });
          }
          commit();
          markReady();
        };

        // Tail loop: stream events from Sledge and apply to collection
        const tail = async () => {
          for await (const item of ledger.tailEvents({
            last: lastCursor,
            signal: signal!,
          })) {
            lastCursor = item.cursor as unknown as number;
            const { eventName, payload } = item.event;
            const p = payload as Record<string, unknown>;

            begin();
            if (eventName === "ticket.created") {
              write({ type: "insert", value: p as unknown as Ticket });
            } else if (eventName === "ticket.updated") {
              // For updates, query the full ticket from Sledge's projection
              const full = (await ledger.query("ticketById", {
                id: p.id as string,
              })) as Ticket | null;
              if (full) {
                write({ type: "update", value: full });
              }
            } else if (eventName === "ticket.deleted") {
              write({
                key: p.id as string,
                type: "delete",
              });
            }
            commit();
          }
        };

        // Run init, then tail
        init()
          .then(() => tail())
          .catch((err) => {
            if (err?.name !== "AbortError") {
              console.error("Sledge collection sync error:", err);
            }
          });

        return {
          cleanup: () => {
            // Signal abort handled externally
          },
        };
      },
    },

    // Write-back: mutations from TanStack DB → Sledge events
    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await ledger.emit("ticket.created", m.modified);
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        // m.changes has only the changed fields, m.key has the ticket id
        await ledger.emit("ticket.updated", { id: m.key, ...m.changes });
      }
    },
    onDelete: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await ledger.emit("ticket.deleted", { id: m.key });
      }
    },
  });

  return collection;
}
