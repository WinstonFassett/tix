import chokidar from 'chokidar'
import path from 'node:path'
import { defineEventHandler } from 'h3'
import { getLedger, getTicketsDir } from '../../../src/lib/server/sledge/singleton'
import { syncFileToLedger, removeFileFromLedger } from '../../../src/lib/server/sledge/sync'

const TICKET_PATTERN = /\(([0-9a-f]{4})\)\.md$/i

function extractTicketId(filepath: string): string | null {
  const match = path.basename(filepath).match(TICKET_PATTERN)
  return match ? match[1]! : null
}

const pendingDeletes = new Map<string, NodeJS.Timeout>()

type Listener = (eventType: string, ticketId: string) => void

// globalThis survives HMR
const _g = globalThis as unknown as {
  __tixSSEListeners?: Set<Listener>
  __tixSSEWatcherInit?: Promise<void> | null
  __tixSSEShutdown?: boolean
}

function getListeners(): Set<Listener> {
  if (!_g.__tixSSEListeners) _g.__tixSSEListeners = new Set()
  return _g.__tixSSEListeners
}

export function notifyTicketChange(eventType: 'ticket-upsert' | 'ticket-delete', ticketId: string) {
  const ls = getListeners()
  for (const l of ls) l(eventType, ticketId)
}

function ensureWatcher() {
  if (_g.__tixSSEWatcherInit) return _g.__tixSSEWatcherInit
  _g.__tixSSEWatcherInit = (async () => {
    const ticketsDir = getTicketsDir()
    const ledger = await getLedger()
    const listeners = getListeners()

    const watcher = chokidar.watch(ticketsDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    })

    watcher
      .on('add', async (fp: string) => {
        const id = extractTicketId(fp)
        if (id && pendingDeletes.has(id)) {
          clearTimeout(pendingDeletes.get(id)!)
          pendingDeletes.delete(id)
        }
        const ticketId = await syncFileToLedger(fp, ledger, ticketsDir)
        if (ticketId) notifyTicketChange('ticket-upsert', ticketId)
      })
      .on('change', async (fp: string) => {
        const ticketId = await syncFileToLedger(fp, ledger, ticketsDir)
        if (ticketId) notifyTicketChange('ticket-upsert', ticketId)
      })
      .on('unlink', async (fp: string) => {
        const id = extractTicketId(fp)
        if (!id) return
        pendingDeletes.set(id, setTimeout(async () => {
          pendingDeletes.delete(id)
          const ticketId = await removeFileFromLedger(fp, ledger)
          if (ticketId) notifyTicketChange('ticket-delete', ticketId)
        }, 200))
      })

    if (!_g.__tixSSEShutdown) {
      _g.__tixSSEShutdown = true
      const shutdown = () => { watcher.close().catch(() => {}) }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    }
  })()
  return _g.__tixSSEWatcherInit
}

export default defineEventHandler(async (event) => {
  // Start watcher (non-blocking — if not ready yet, events will arrive once it is)
  ensureWatcher().catch(() => {})

  const res = event.node.res as any
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  res.write(`event: hello\ndata: {}\n\n`)

  const listeners = getListeners()
  const listener: Listener = (eventType, ticketId) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify({ id: ticketId })}\n\n`)
  }
  listeners.add(listener)

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`)
  }, 20_000)
  heartbeat.unref?.()

  event.node.req.on('close', () => {
    clearInterval(heartbeat)
    listeners.delete(listener)
  })
  event.node.req.on('error', () => {
    clearInterval(heartbeat)
    listeners.delete(listener)
  })

  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })
})
