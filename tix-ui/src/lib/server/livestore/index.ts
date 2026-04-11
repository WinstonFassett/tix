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
  query(name: 'allTickets'): TicketRow[]
  commit(...events: unknown[]): void
  shutdown(): Promise<void>
  /** Raw LiveStore instance for advanced usage */
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
