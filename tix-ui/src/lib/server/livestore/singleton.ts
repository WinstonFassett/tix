import path from 'node:path'
import fs from 'node:fs'
import { createTicketStore, type TicketStore } from './index.js'
import { hydrateFromFiles, setProjectionGuard } from './sync.js'

let _store: TicketStore | null = null
let _initPromise: Promise<TicketStore> | null = null

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

function resolveStorageDir(): string {
  const ticketsDir = resolveTicketsDir()
  const tixDir = path.join(path.dirname(ticketsDir), '.tix')
  fs.mkdirSync(tixDir, { recursive: true })
  return tixDir
}

/**
 * Get or initialize the shared LiveStore ticket store.
 * First call hydrates from existing .md files on disk.
 */
export async function getStore(): Promise<TicketStore> {
  if (_store) return _store
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const storageDir = resolveStorageDir()
    const ticketsDir = resolveTicketsDir()
    const store = await createTicketStore({ storageDir })

    // Wire up loop guard — dynamically import the SSE module's markAsProjected
    // if available (only when the server is running, not in tests)
    try {
      const { markAsProjected } = await import('../../../../server/routes/api/tickets-events.get.js')
      setProjectionGuard(markAsProjected)
    } catch {
      // Not available (e.g. in tests) — no guard needed
    }

    // If store is empty (fresh DB), hydrate from existing .md files
    const existing = store.query('allTickets')
    if (existing.length === 0) {
      const count = await hydrateFromFiles(store, ticketsDir)
      if (count > 0) {
        console.log(`[tix-store] Hydrated ${count} tickets from ${ticketsDir}`)
      }
    }

    _store = store
    return store
  })()

  return _initPromise
}

/**
 * Get the tickets directory path.
 */
export function getTicketsDir(): string {
  return resolveTicketsDir()
}

/**
 * Shutdown the store (for graceful shutdown / tests).
 */
export async function shutdownStore(): Promise<void> {
  if (_store) {
    await _store.shutdown()
    _store = null
    _initPromise = null
  }
}
