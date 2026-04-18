/**
 * Client-side TanStack DB collection backed by the getTickets server function.
 * WebSocket events trigger a full refetch and diff against the collection.
 */
import { createCollection, type CollectionImpl } from "@tanstack/db";
import type { Ticket } from "../types";
import { getTickets, createTicket, updateTicket, deleteTicket } from "../server/tickets";
import { queryClient } from "../../routes/__root";

export type TicketCollection = CollectionImpl<Ticket, string, any, any, any>;

let _collection: TicketCollection | null = null;
let _ws: WebSocket | null = null;
let _seedData: Ticket[] | null = null;

/**
 * Seed the collection with data from SSR (avoids redundant fetch).
 * Call before getTicketCollection() — typically from useTickets() with React Query data.
 */
export function seedTicketCollection(tickets: Ticket[]) {
  if (!_seedData && tickets.length > 0) {
    _seedData = tickets;
  }
}

/**
 * Get the singleton ticket collection.
 */
export function getTicketCollection(): TicketCollection {
  if (_collection) return _collection;

  _collection = createCollection<Ticket, string>({
    id: "tickets",
    getKey: (ticket) => ticket.id,

    sync: {
      rowUpdateMode: 'full',
      sync: ({ begin, write, commit, markReady }) => {
        let disposed = false;

        // Load initial data — use seed from SSR if available, otherwise fetch
        const load = async () => {
          const tickets = _seedData ?? await getTickets();
          _seedData = null;
          if (disposed) return;
          begin();
          for (const ticket of tickets) {
            write({ type: "insert", value: ticket });
          }
          commit();
          markReady();
        };

        // Refresh: fetch all tickets and diff against current state
        const refresh = async () => {
          if (disposed) return;
          try {
            const tickets = await getTickets();
            if (disposed) return;

            const currentKeys = new Set(_collection!.state.keys());

            begin();

            // Upserts
            for (const ticket of tickets) {
              if (currentKeys.has(ticket.id)) {
                write({ type: "update", value: ticket });
              } else {
                write({ type: "insert", value: ticket });
              }
              currentKeys.delete(ticket.id);
            }

            // Deletes — keys in current but not in new
            for (const key of currentKeys) {
              write({ key, type: "delete" });
            }

            commit();
          } catch {
            // Swallow — will retry on next WS event
          }
        };

        // WebSocket listener — refresh collection + invalidate detail queries
        if (typeof window !== "undefined") {
          let connected = false;
          const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
          _ws = new WebSocket(`${protocol}://${location.host}/api/tickets-ws`);
          _ws.addEventListener("message", (e) => {
            const msg = JSON.parse(e.data);
            if (msg.event === 'hello') {
              if (connected) {
                // Reconnected after a drop — full refresh to catch missed events
                refresh();
                queryClient.invalidateQueries({ queryKey: ['activity'] });
              }
              connected = true;
              return;
            }
            if (msg.event === 'ticket-upsert') {
              refresh();
              queryClient.invalidateQueries({ queryKey: ['ticket', msg.id] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
              queryClient.invalidateQueries({ queryKey: ['ticket-history', msg.id] });
            } else if (msg.event === 'ticket-delete') {
              refresh();
              queryClient.removeQueries({ queryKey: ['ticket', msg.id] });
              queryClient.invalidateQueries({ queryKey: ['activity'] });
            }
          });
          _ws.addEventListener("close", () => {
            // Auto-reconnect after a delay
            if (!disposed) {
              setTimeout(() => {
                if (!disposed) {
                  // Force collection recreation on reconnect
                  _collection = null;
                  _ws = null;
                  getTicketCollection();
                }
              }, 2000);
            }
          });
        }

        load().catch((err) => {
          console.error("[ticket-collection] initial load failed:", err);
        });

        return {
          cleanup: () => {
            disposed = true;
            if (_ws) {
              _ws.close();
              _ws = null;
            }
          },
        };
      },
    },

    // Write-back: client mutations → server functions
    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        const ticket = m.modified as Ticket;
        await createTicket({
          data: {
            title: ticket.title,
            description: ticket.body,
            type: ticket.type,
            priority: ticket.priority,
            assignee: ticket.assignee,
            tags: ticket.tags,
          },
        });
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await updateTicket({
          data: {
            ticketId: m.key as string,
            updates: m.changes as Record<string, unknown>,
          },
        });
      }
    },
    onDelete: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await deleteTicket({ data: { ticketId: m.key as string } });
      }
    },
  }) as TicketCollection;

  return _collection;
}

// Clean up on HMR — close leaked WebSocket connections
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_ws) {
      _ws.close();
      _ws = null;
    }
    _collection = null;
    _seedData = null;
  });
}
