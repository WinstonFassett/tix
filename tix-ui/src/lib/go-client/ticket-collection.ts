/**
 * Go-mode ticket collection — same interface as lib/client/ticket-collection.ts
 * but connects WebSocket to /ws (Go server endpoint).
 */
import { createCollection, type CollectionImpl } from '@tanstack/db'
import type { Ticket } from '../types'
import { getTickets, createTicket, updateTicket, deleteTicket } from './tickets'
import { queryClient } from '../../routes/__root.go'

export type TicketCollection = CollectionImpl<Ticket, string, any, any, any>

let _collection: TicketCollection | null = null
let _ws: WebSocket | null = null
let _seedData: Ticket[] | null = null
let _initialLoadComplete = false

export function isTicketInitialLoadComplete(): boolean {
  return _initialLoadComplete
}

export function seedTicketCollection(tickets: Ticket[]) {
  if (!_seedData && tickets.length > 0) {
    _seedData = tickets
  }
}

export function getTicketCollection(): TicketCollection {
  if (_collection) return _collection

  _collection = createCollection<Ticket, string>({
    id: 'tickets',
    getKey: (ticket) => ticket.id,

    sync: {
      rowUpdateMode: 'full',
      sync: ({ begin, write, commit, markReady }) => {
        let disposed = false

        const load = async () => {
          const tickets = _seedData ?? await getTickets()
          _seedData = null
          if (disposed) return
          begin()
          for (const ticket of tickets) {
            write({ type: 'insert', value: ticket })
          }
          commit()
          markReady()
          _initialLoadComplete = true
        }

        const refresh = async () => {
          if (disposed) return
          try {
            const tickets = await getTickets()
            if (disposed) return
            const currentKeys = new Set(_collection!.state.keys())
            begin()
            for (const ticket of tickets) {
              if (currentKeys.has(ticket.id)) {
                write({ type: 'update', value: ticket })
              } else {
                write({ type: 'insert', value: ticket })
              }
              currentKeys.delete(ticket.id)
            }
            for (const key of currentKeys) {
              write({ key, type: 'delete' })
            }
            commit()
          } catch {
            // will retry on next WS event
          }
        }

        if (typeof window !== 'undefined') {
          let connected = false
          const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
          _ws = new WebSocket(`${protocol}://${location.host}/ws`)
          _ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data)
            if (msg.event === 'hello') {
              if (connected) {
                refresh()
                queryClient.invalidateQueries({ queryKey: ['activity'] })
              }
              connected = true
              return
            }
            if (msg.event === 'ticket-upsert') {
              refresh()
              queryClient.invalidateQueries({ queryKey: ['ticket', msg.id] })
              queryClient.invalidateQueries({ queryKey: ['activity'] })
              queryClient.invalidateQueries({ queryKey: ['ticket-history', msg.id] })
            } else if (msg.event === 'ticket-delete') {
              refresh()
              queryClient.removeQueries({ queryKey: ['ticket', msg.id] })
              queryClient.invalidateQueries({ queryKey: ['activity'] })
            }
          })
          _ws.addEventListener('close', () => {
            if (!disposed) {
              setTimeout(() => {
                if (!disposed) {
                  _collection = null
                  _ws = null
                  getTicketCollection()
                }
              }, 2000)
            }
          })
        }

        load().catch((err) => {
          console.error('[ticket-collection] initial load failed:', err)
        })

        return {
          cleanup: () => {
            disposed = true
            if (_ws) {
              _ws.close()
              _ws = null
            }
          },
        }
      },
    },

    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        const ticket = m.modified as Ticket
        await createTicket({
          data: {
            title: ticket.title,
            description: ticket.body,
            type: ticket.type,
            priority: ticket.priority,
            assignee: ticket.assignee,
            tags: ticket.tags,
          },
        })
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await updateTicket({
          data: {
            ticketId: m.key as string,
            updates: m.changes as Record<string, unknown>,
          },
        })
      }
    },
    onDelete: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await deleteTicket({ data: { ticketId: m.key as string } })
      }
    },
  }) as TicketCollection

  return _collection
}
