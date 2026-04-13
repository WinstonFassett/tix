import chokidar, { type FSWatcher } from 'chokidar'
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

interface WatcherState {
  listeners: Set<Listener>
  watcher: FSWatcher
  responses: Set<{ end: () => void }>
}

let state: WatcherState | null = null
let statePromise: Promise<WatcherState> | null = null
let shutdownInstalled = false

export function notifyTicketChange(eventType: 'ticket-upsert' | 'ticket-delete', ticketId: string) {
  if (!state) return
  for (const l of state.listeners) l(eventType, ticketId)
}

function installShutdown() {
  if (shutdownInstalled) return
  shutdownInstalled = true
  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    if (!state) return
    for (const r of state.responses) {
      try { r.end() } catch { /* ignore */ }
    }
    state.responses.clear()
    state.listeners.clear()
    state.watcher.close().catch(() => {})
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('beforeExit', shutdown)
}

async function getState(): Promise<WatcherState> {
  if (state) return state
  if (statePromise) return statePromise
  statePromise = initState()
  return statePromise
}

async function initState(): Promise<WatcherState> {
  const ticketsDir = getTicketsDir()
  const ledger = await getLedger()
  const listeners = new Set<Listener>()
  const responses = new Set<{ end: () => void }>()

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
      if (ticketId) {
        for (const l of listeners) l('ticket-upsert', ticketId)
      }
    })
    .on('change', async (fp: string) => {
      const ticketId = await syncFileToLedger(fp, ledger, ticketsDir)
      if (ticketId) {
        for (const l of listeners) l('ticket-upsert', ticketId)
      }
    })
    .on('unlink', async (fp: string) => {
      const id = extractTicketId(fp)
      if (!id) return
      pendingDeletes.set(id, setTimeout(async () => {
        pendingDeletes.delete(id)
        const ticketId = await removeFileFromLedger(fp, ledger)
        if (ticketId) {
          for (const l of listeners) l('ticket-delete', ticketId)
        }
      }, 200))
    })

  state = { listeners, watcher, responses }
  installShutdown()
  return state
}

export default defineEventHandler(async (event) => {
  const { listeners, responses } = await getState()

  const res = event.node.res as any
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(`event: hello\ndata: {}\n\n`)

  const listener: Listener = (eventType, ticketId) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify({ id: ticketId })}\n\n`)
  }
  listeners.add(listener)

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`)
  }, 20_000)
  heartbeat.unref?.()

  const responseEntry = { end: () => { try { res.end() } catch { /* ignore */ } } }
  responses.add(responseEntry)

  const cleanup = () => {
    clearInterval(heartbeat)
    listeners.delete(listener)
    responses.delete(responseEntry)
  }

  event.node.req.on('close', cleanup)
  event.node.req.on('error', cleanup)

  // Hold the handler open — this is an SSE stream
  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })
})
