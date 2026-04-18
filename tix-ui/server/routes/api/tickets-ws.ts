import chokidar from 'chokidar'
import path from 'node:path'
import { defineWebSocketHandler } from 'h3'
import type { Peer } from 'crossws'
import { getLedger, getTicketsDir } from '../../../src/lib/server/sledge/singleton'
import { syncFileToLedger, removeFileFromLedger } from '../../../src/lib/server/sledge/sync'

const TICKET_PATTERN = /\(([0-9a-f]{4})\)\.md$/i

function extractTicketId(filepath: string): string | null {
  const match = path.basename(filepath).match(TICKET_PATTERN)
  return match ? match[1]! : null
}

// globalThis survives HMR
const _g = globalThis as unknown as {
  __tixWSPeers?: Set<Peer>
  __tixWSWatcherInit?: Promise<void> | null
  __tixWSShutdown?: boolean
  __tixPendingDeletes?: Map<string, NodeJS.Timeout>
}

function getPendingDeletes(): Map<string, NodeJS.Timeout> {
  if (!_g.__tixPendingDeletes) _g.__tixPendingDeletes = new Map()
  return _g.__tixPendingDeletes
}

function getPeers(): Set<Peer> {
  if (!_g.__tixWSPeers) _g.__tixWSPeers = new Set()
  return _g.__tixWSPeers
}

export function notifyTicketChange(eventType: 'ticket-upsert' | 'ticket-delete', ticketId: string) {
  const msg = JSON.stringify({ event: eventType, id: ticketId })
  for (const peer of getPeers()) {
    try { peer.send(msg) } catch { /* peer may have disconnected */ }
  }
}

function ensureWatcher() {
  if (_g.__tixWSWatcherInit) return _g.__tixWSWatcherInit
  _g.__tixWSWatcherInit = (async () => {
    const ticketsDir = getTicketsDir()
    const ledger = await getLedger()

    const watcher = chokidar.watch(ticketsDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    })

    watcher
      .on('add', async (fp: string) => {
        const id = extractTicketId(fp)
        if (id && getPendingDeletes().has(id)) {
          clearTimeout(getPendingDeletes().get(id)!)
          getPendingDeletes().delete(id)
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
        getPendingDeletes().set(id, setTimeout(async () => {
          getPendingDeletes().delete(id)
          const ticketId = await removeFileFromLedger(fp, ledger)
          if (ticketId) notifyTicketChange('ticket-delete', ticketId)
        }, 200))
      })

    if (!_g.__tixWSShutdown) {
      _g.__tixWSShutdown = true
      const shutdown = () => { watcher.close().catch(() => {}) }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    }
  })()
  return _g.__tixWSWatcherInit
}

// Start watcher eagerly so file changes are detected even before first WS connection
ensureWatcher().catch(() => {})

export default defineWebSocketHandler({
  open(peer) {
    getPeers().add(peer)
    peer.send(JSON.stringify({ event: 'hello' }))
  },
  close(peer) {
    getPeers().delete(peer)
  },
  error(peer) {
    getPeers().delete(peer)
  },
})
