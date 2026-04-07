import chokidar from 'chokidar'
import path from 'node:path'
import { defineEventHandler } from 'h3'

// Singleton chokidar watcher shared by all SSE clients. The first request
// initializes it; subsequent requests reuse the same watcher. Each request
// registers its own listener and cleans up on disconnect.

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

type Listener = () => void

interface WatcherState {
  listeners: Set<Listener>
  watcher: chokidar.FSWatcher
}

let state: WatcherState | null = null

function getState(): WatcherState {
  if (state) return state
  const ticketsDir = resolveTicketsDir()
  const listeners = new Set<Listener>()
  const watcher = chokidar.watch(ticketsDir, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  })
  const notify = () => { for (const l of listeners) l() }
  watcher.on('add', notify).on('change', notify).on('unlink', notify)
    .on('addDir', notify).on('unlinkDir', notify)
  state = { listeners, watcher }
  return state
}

export default defineEventHandler(async (event) => {
  const { listeners } = getState()

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
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`)
  }, 20_000)

  const cleanup = () => {
    clearInterval(heartbeat)
    listeners.delete(listener)
  }

  event.node.req.on('close', cleanup)
  event.node.req.on('error', cleanup)

  // Keep the handler alive until the client disconnects.
  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })

  return ''
})
