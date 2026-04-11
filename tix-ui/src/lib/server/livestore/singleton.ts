import path from 'node:path'
import fs from 'node:fs'
import { createTicketStore, type TicketStore } from './index.js'
import { hydrateFromFiles, setProjectionGuard } from './sync.js'

// Use globalThis to share the singleton across Vite's module contexts.
// Nitro server routes and TanStack Start server functions run in isolated
// module scopes — module-level variables are NOT shared between them.
const _g = globalThis as unknown as {
  __tixStore?: TicketStore | null
  __tixInitPromise?: Promise<TicketStore> | null
}

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
  if (_g.__tixStore) return _g.__tixStore
  if (_g.__tixInitPromise) return _g.__tixInitPromise

  _g.__tixInitPromise = (async () => {
    try {
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

      _g.__tixStore = store
      return store
    } catch (err) {
      // Reset so next call retries instead of returning a rejected promise
      _g.__tixInitPromise = null
      throw err
    }
  })()

  return _g.__tixInitPromise
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
  if (_g.__tixStore) {
    await _g.__tixStore.shutdown()
    _g.__tixStore = null
    _g.__tixInitPromise = null
  }
}
