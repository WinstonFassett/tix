import chokidar from 'chokidar'
import path from 'node:path'
import { defineEventHandler } from 'h3'

// Singleton chokidar watcher shared by all SSE clients. The first request
// initializes it; subsequent requests reuse the same watcher. Each request
// registers its own listener and cleans up on disconnect. Shutdown is
// handled at the process level (see installShutdown below) so Ctrl+C can
// tear everything down without hanging on persistent connections.

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

type Listener = () => void

interface WatcherState {
  listeners: Set<Listener>
  watcher: chokidar.FSWatcher
  responses: Set<{ end: () => void }>
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
    // End every open SSE response so the keep-alive sockets can drain
    // and stop pinning the http server's close().
    for (const r of state.responses) {
      try { r.end() } catch { /* ignore */ }
    }
    state.responses.clear()
    state.listeners.clear()
    // Close chokidar so its filesystem watch handles release the loop.
    state.watcher.close().catch(() => {})
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('beforeExit', shutdown)
}

function getState(): WatcherState {
  if (state) return state
  const ticketsDir = resolveTicketsDir()
  const listeners = new Set<Listener>()
  const responses = new Set<{ end: () => void }>()
  const watcher = chokidar.watch(ticketsDir, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  })
  const notify = () => { for (const l of listeners) l() }
  watcher.on('add', notify).on('change', notify).on('unlink', notify)
    .on('addDir', notify).on('unlinkDir', notify)
  state = { listeners, watcher, responses }
  installShutdown()
  return state
}

export default defineEventHandler(async (event) => {
  const { listeners, responses } = getState()

  const res = event.node.res
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  // Hello + initial tick so client knows the stream is live.
  res.write(`event: hello\ndata: {}\n\n`)

  const listener: Listener = () => {
    res.write(`event: tickets-update\ndata: {}\n\n`)
  }
  listeners.add(listener)

  // Heartbeat every 20s to keep intermediaries from closing the connection.
  // unref() so the timer alone can't keep the event loop alive at shutdown.
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

  // Keep the handler alive until the client (or shutdown) closes the
  // underlying socket. The promise resolves on req 'close', which is
  // also emitted when we forcibly end() the response from shutdown.
  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })

  return ''
})
