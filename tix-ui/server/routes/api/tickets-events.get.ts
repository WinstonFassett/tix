import chokidar from 'chokidar'
import path from 'node:path'
import fs from 'node:fs'
import matter from 'gray-matter'
import { defineEventHandler } from 'h3'
import { getStore, getTicketsDir } from '../../../src/lib/server/livestore/singleton.js'
import { events } from '../../../src/lib/server/livestore/index.js'

// Singleton chokidar watcher shared by all SSE clients. The first request
// initializes it; subsequent requests reuse the same watcher. Each request
// registers its own listener and cleans up on disconnect. Shutdown is
// handled at the process level (see installShutdown below) so Ctrl+C can
// tear everything down without hanging on persistent connections.

const TICKET_PATTERN = /\(([0-9a-f]{4})\)\.md$/i

function resolveTicketsDir(): string {
  return getTicketsDir()
}

type Listener = (eventType: string, ticketId: string) => void

interface WatcherState {
  listeners: Set<Listener>
  watcher: chokidar.FSWatcher
  responses: Set<{ end: () => void }>
}

let state: WatcherState | null = null
let shutdownInstalled = false

// Loop guard: files we recently projected from the store.
// Chokidar should ignore these to prevent feedback loops.
const recentlyProjected = new Set<string>()
const PROJECTION_GUARD_MS = 500

export function markAsProjected(filepath: string): void {
  recentlyProjected.add(filepath)
  setTimeout(() => recentlyProjected.delete(filepath), PROJECTION_GUARD_MS)
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

function extractTicketId(filepath: string): string | null {
  const match = path.basename(filepath).match(TICKET_PATTERN)
  return match ? match[1]! : null
}

async function syncFileToStore(filepath: string) {
  if (recentlyProjected.has(filepath)) return null

  const ticketId = extractTicketId(filepath)
  if (!ticketId) return null

  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    const { data, content } = matter(raw)
    const store = await getStore()
    const ticketsDir = resolveTicketsDir()
    const relPath = path.relative(ticketsDir, filepath)
    const folder = path.dirname(relPath) === '.' ? '' : path.dirname(relPath)

    const existing = store.query('allTickets').find(r => r.id === ticketId)

    if (existing) {
      // Update existing ticket
      store.commit(events.ticketUpdated({
        id: ticketId,
        title: data.title || existing.title,
        status: data.status || existing.status,
        type: data.type || existing.type,
        priority: data.priority ?? existing.priority,
        assignee: data.assignee ?? existing.assignee,
        tags: data.tags || JSON.parse(existing.tags),
        deps: data.deps || JSON.parse(existing.deps),
        links: data.links || JSON.parse(existing.links),
        body: content.trim(),
        folder,
        filename: relPath,
      }))
    } else {
      // New ticket from external source
      store.commit(events.ticketCreated({
        id: ticketId,
        title: data.title || '',
        status: data.status || 'open',
        type: data.type || 'task',
        priority: data.priority ?? 2,
        assignee: data.assignee || '',
        tags: data.tags || [],
        deps: data.deps || [],
        links: data.links || [],
        created: data.created ? String(data.created) : new Date().toISOString(),
        body: content.trim(),
        folder,
        filename: relPath,
      }))
    }

    return ticketId
  } catch {
    return null
  }
}

async function removeFileFromStore(filepath: string) {
  if (recentlyProjected.has(filepath)) return null

  const ticketId = extractTicketId(filepath)
  if (!ticketId) return null

  try {
    const store = await getStore()
    const existing = store.query('allTickets').find(r => r.id === ticketId)
    if (existing) {
      store.commit(events.ticketDeleted({ id: ticketId }))
    }
    return ticketId
  } catch {
    return null
  }
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

  const notifyUpsert = (ticketId: string) => {
    for (const l of listeners) l('ticket-upsert', ticketId)
  }
  const notifyDelete = (ticketId: string) => {
    for (const l of listeners) l('ticket-delete', ticketId)
  }

  watcher
    .on('add', async (fp: string) => {
      const id = await syncFileToStore(fp)
      if (id) notifyUpsert(id)
    })
    .on('change', async (fp: string) => {
      const id = await syncFileToStore(fp)
      if (id) notifyUpsert(id)
    })
    .on('unlink', async (fp: string) => {
      const id = await removeFileFromStore(fp)
      if (id) notifyDelete(id)
    })

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

  const listener: Listener = (eventType, ticketId) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify({ id: ticketId })}\n\n`)
  }
  listeners.add(listener)

  // Heartbeat every 20s to keep intermediaries from closing the connection.
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
