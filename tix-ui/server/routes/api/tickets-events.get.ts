import chokidar, { type FSWatcher } from 'chokidar'
import { defineEventHandler } from 'h3'
import { getLedger, getTicketsDir } from '../../../src/lib/server/sledge/singleton'
import { syncFileToLedger, removeFileFromLedger } from '../../../src/lib/server/sledge/sync'

type Listener = (eventType: string, ticketId: string, seq?: number) => void

interface WatcherState {
  listeners: Set<Listener>
  watcher: FSWatcher
  responses: Set<{ end: () => void }>
  tailController: AbortController
}

let state: WatcherState | null = null
let shutdownInstalled = false

function installShutdown() {
  if (shutdownInstalled) return
  shutdownInstalled = true
  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    if (!state) return
    state.tailController.abort()
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

  const ticketsDir = getTicketsDir()
  const ledger = await getLedger()
  const listeners = new Set<Listener>()
  const responses = new Set<{ end: () => void }>()
  const tailController = new AbortController()

  // Chokidar watches for external file edits (CLI, editor)
  // Changes go through syncFileToLedger which diffs before emitting
  const watcher = chokidar.watch(ticketsDir, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  })

  watcher
    .on('add', async (fp: string) => {
      await syncFileToLedger(fp, ledger, ticketsDir)
      // tailEvents will pick up the resulting event and notify listeners
    })
    .on('change', async (fp: string) => {
      await syncFileToLedger(fp, ledger, ticketsDir)
    })
    .on('unlink', async (fp: string) => {
      await removeFileFromLedger(fp, ledger)
    })

  // Sledge tailEvents — streams ALL events (from UI mutations, file sync, etc.)
  // and broadcasts to SSE clients. This is the single notification path.
  ;(async () => {
    try {
      for await (const item of ledger.tailEvents({
        last: 0,
        signal: tailController.signal,
      })) {
        const { eventName, payload } = item.event
        const p = payload as Record<string, unknown>
        const seq = item.cursor as unknown as number

        if (eventName === 'ticket.created' || eventName === 'ticket.updated') {
          for (const l of listeners) l('ticket-upsert', p.id as string, seq)
        } else if (eventName === 'ticket.deleted') {
          for (const l of listeners) l('ticket-delete', p.id as string, seq)
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[tix-sse] tailEvents error:', err)
      }
    }
  })()

  state = { listeners, watcher, responses, tailController }
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
  res.flushHeaders?.()

  // Hello event so client knows stream is live
  res.write(`event: hello\ndata: {}\n\n`)

  const listener: Listener = (eventType, ticketId, seq) => {
    const data = JSON.stringify({ id: ticketId, seq })
    res.write(`id: ${seq}\nevent: ${eventType}\ndata: ${data}\n\n`)
  }
  listeners.add(listener)

  // Heartbeat every 20s
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

  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })

  return ''
})
