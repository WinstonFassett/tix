/**
 * Client-side TanStack DB collection backed by the getTickets server function.
 * SSE events trigger a full refetch and diff against the collection.
 */
import { createCollection, type CollectionImpl } from "@tanstack/db";
import type { Ticket } from "../types";
import { getTickets, createTicket, updateTicket, deleteTicket } from "../server/tickets";
import { queryClient } from "../../routes/__root";

export type TicketCollection = CollectionImpl<Ticket, string, any, any, any>;

let _collection: TicketCollection | null = null;
let _eventSource: EventSource | null = null;
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
            // Swallow — will retry on next SSE event
          }
        };

        // SSE listener — refresh collection + invalidate detail queries
        if (typeof window !== "undefined" && typeof EventSource !== "undefined") {
          _eventSource = new EventSource("/api/tickets-events");
          _eventSource.addEventListener("ticket-upsert", (e) => {
            refresh();
            const { id } = JSON.parse((e as MessageEvent).data);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
          });
          _eventSource.addEventListener("ticket-delete", (e) => {
            refresh();
            const { id } = JSON.parse((e as MessageEvent).data);
            queryClient.removeQueries({ queryKey: ['ticket', id] });
          });
        }

        load().catch((err) => {
          console.error("[ticket-collection] initial load failed:", err);
        });

        return {
          cleanup: () => {
            disposed = true;
            if (_eventSource) {
              _eventSource.close();
              _eventSource = null;
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
