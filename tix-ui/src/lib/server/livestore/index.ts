import { createStorePromise, queryDb } from '@livestore/livestore'
import { makeAdapter } from '@livestore/adapter-node'
import { schema, tables, events } from './schema.js'

export { events, tables, schema }

// --- Reactive queries ---

export const allTickets$ = queryDb(
  tables.tickets.orderBy('priority', 'asc'),
  { label: 'allTickets' },
)

// --- Store wrapper ---

export interface TicketStore {
  /** Query all tickets (includes body) */
  query(name: 'allTickets'): TicketRow[]
  /** Query all tickets without body (for list views) */
  queryList(): TicketListRow[]
  /** Query a single ticket by ID (includes body) */
  queryById(id: string): TicketRow | undefined
  /** Search tickets by text (title, body, tags, assignee) */
  search(query: string, limit?: number): TicketRow[]
  /** Get folder counts for sidebar tree */
  queryFolderCounts(): Array<{ folder: string; count: number }>
  /** Commit events */
  commit(...events: unknown[]): void
  /** Shutdown the store */
  shutdown(): Promise<void>
  /** Raw LiveStore instance */
  raw: unknown
}

export interface TicketRow {
  id: string
  title: string
  status: string
  type: string
  priority: number
  assignee: string
  tags: string  // JSON array
  deps: string  // JSON array
  links: string // JSON array
  created: string
  body: string
  folder: string
  filename: string
}

/** Ticket without body — for list views */
export type TicketListRow = Omit<TicketRow, 'body'>

export async function createTicketStore(opts: {
  storageDir: string
  storeId?: string
}): Promise<TicketStore> {
  const adapter = makeAdapter({
    storage: { type: 'fs', baseDirectory: opts.storageDir },
  })

  const store = await createStorePromise({
    adapter,
    schema,
    storeId: opts.storeId ?? 'tix',
  })

  return {
    query(name: string) {
      if (name === 'allTickets') {
        return store.query(allTickets$) as TicketRow[]
      }
      throw new Error(`Unknown query: ${name}`)
    },

    queryList() {
      // Return all fields except body for list views
      const rows = store.query(allTickets$) as TicketRow[]
      return rows.map(({ body: _body, ...rest }) => rest)
    },

    queryById(id: string) {
      const rows = store.query(allTickets$) as TicketRow[]
      return rows.find(r => r.id === id)
    },

    search(query: string, limit = 50) {
      // Case-insensitive search across title, body, tags, assignee
      const rows = store.query(allTickets$) as TicketRow[]
      const q = query.toLowerCase()
      return rows
        .filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          r.tags.toLowerCase().includes(q) ||
          r.assignee.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
        )
        .slice(0, limit)
    },

    queryFolderCounts() {
      const rows = store.query(allTickets$) as TicketRow[]
      const counts = new Map<string, number>()
      for (const r of rows) {
        const folder = r.folder || ''
        counts.set(folder, (counts.get(folder) || 0) + 1)
      }
      return Array.from(counts.entries()).map(([folder, count]) => ({ folder, count }))
    },

    commit(...evts: unknown[]) {
      for (const evt of evts) {
        store.commit(evt as any)
      }
    },

    async shutdown() {
      await store.shutdown()
    },

    raw: store,
  }
}
