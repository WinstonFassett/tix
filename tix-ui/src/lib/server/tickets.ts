import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Ticket } from '../types'
import { getStore, getTicketsDir } from './livestore/singleton.js'
import { events, type TicketRow } from './livestore/index.js'
import { projectTicketToFile } from './livestore/sync.js'

const VALID_STATUSES = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']
export const DEFAULT_IGNORED_FOLDERS = ['archive']

/** Convert a LiveStore row (JSON string arrays) to the Ticket interface (real arrays). */
function rowToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Ticket['status'],
    type: row.type,
    priority: row.priority,
    assignee: row.assignee,
    tags: JSON.parse(row.tags),
    deps: JSON.parse(row.deps),
    links: JSON.parse(row.links),
    created: row.created,
    body: row.body,
    filename: row.filename,
    folder: row.folder,
  }
}

function sanitizeTitle(title: string): string {
  let clean = title
    .replace(/[^a-zA-Z0-9 -]/g, '')
    .replace(/ +/g, ' ')
    .trim()

  clean = clean
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  if (!clean) clean = 'Untitled-Ticket'
  clean = clean.substring(0, 50).trimEnd()
  return clean
}

function syncBodyTitle(content: string, newTitle: string): string {
  const lines = content.split('\n')
  let headingIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === '') continue
    if (lines[i]!.match(/^# /)) headingIdx = i
    break
  }
  if (headingIdx >= 0) {
    lines[headingIdx] = `# ${newTitle}`
  } else {
    lines.unshift(`# ${newTitle}`, '')
  }
  return lines.join('\n')
}

function generateId(): string {
  return crypto.randomBytes(2).toString('hex')
}

// --- Server Functions ---

export const getTickets = createServerFn({ method: 'GET' }).handler(async () => {
  fs.appendFileSync('/tmp/tix-debug.log', `[${new Date().toISOString()}] getTickets called\n`)
  try {
    const store = await getStore()
    const rows = store.query('allTickets')
    fs.appendFileSync('/tmp/tix-debug.log', `[${new Date().toISOString()}] returning ${rows.length} tickets\n`)
    return rows.map(rowToTicket)
  } catch (err) {
    fs.appendFileSync('/tmp/tix-debug.log', `[${new Date().toISOString()}] ERROR: ${err}\n`)
    throw err
  }
})

export const getConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const ticketsDir = getTicketsDir()
  const resolvedDir = path.resolve(ticketsDir)
  const workspacePath = path.dirname(resolvedDir)
  return {
    ticketsDir: resolvedDir,
    workspaceName: path.basename(workspacePath),
    workspacePath,
  }
})

export const createTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { title: string; description?: string; type?: string; priority?: number; assignee?: string; tags?: string[] }) => data)
  .handler(async ({ data }) => {
    const { title, description, type, priority, assignee, tags } = data

    if (!title) {
      throw new Error('Title is required')
    }

    const store = await getStore()
    const ticketsDir = getTicketsDir()
    const id = generateId()
    const cleanTitle = sanitizeTitle(title)
    const filename = `${cleanTitle} (${id}).md`
    const body = description || ''

    store.commit(events.ticketCreated({
      id,
      title,
      status: 'open',
      type: type || 'task',
      priority: priority ?? 2,
      assignee: assignee || '',
      tags: tags || [],
      deps: [],
      links: [],
      created: new Date().toISOString(),
      body,
      folder: '',
      filename,
    }))

    // Project to .md file
    const rows = store.query('allTickets')
    const row = rows.find(r => r.id === id)
    if (row) {
      projectTicketToFile(row, ticketsDir)
    }

    return { ok: true as const, id, output: `Created ${filename}` }
  })

export const updateTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string; updates: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const { ticketId, updates } = data
    const store = await getStore()
    const ticketsDir = getTicketsDir()

    if (updates.status && typeof updates.status === 'string' && !VALID_STATUSES.includes(updates.status)) {
      throw new Error(`Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}`)
    }

    // Find current ticket to get old filename for cleanup
    const rows = store.query('allTickets')
    const existing = rows.find(r => r.id === ticketId)
    if (!existing) {
      throw new Error(`Ticket ${ticketId} not found`)
    }

    const oldFilename = existing.filename

    // Build update event payload
    const eventUpdates: Record<string, unknown> = { id: ticketId }
    if (updates.title !== undefined) eventUpdates.title = updates.title
    if (updates.status !== undefined) eventUpdates.status = updates.status
    if (updates.priority !== undefined) eventUpdates.priority = updates.priority
    if (updates.assignee !== undefined) eventUpdates.assignee = updates.assignee
    if (updates.type !== undefined) eventUpdates.type = updates.type
    if (updates.tags !== undefined) eventUpdates.tags = updates.tags

    // Handle body + title sync
    if (updates.body !== undefined) {
      let body = updates.body as string
      if (updates.title !== undefined) {
        body = syncBodyTitle(body, updates.title as string)
      }
      eventUpdates.body = body
    } else if (updates.title !== undefined) {
      eventUpdates.body = syncBodyTitle(existing.body, updates.title as string)
    }

    // Handle filename change on title rename
    if (updates.title !== undefined) {
      const cleanTitle = sanitizeTitle(updates.title as string)
      const folder = existing.folder
      const newBasename = `${cleanTitle} (${ticketId}).md`
      eventUpdates.filename = folder ? `${folder}/${newBasename}` : newBasename
    }

    store.commit(events.ticketUpdated(eventUpdates as any))

    // Project updated ticket to file
    const updatedRows = store.query('allTickets')
    const updatedRow = updatedRows.find(r => r.id === ticketId)
    if (updatedRow) {
      projectTicketToFile(updatedRow, ticketsDir)
      // Clean up old file if renamed
      if (updatedRow.filename !== oldFilename) {
        const oldPath = path.join(ticketsDir, oldFilename)
        try { fs.unlinkSync(oldPath) } catch { /* may not exist */ }
      }
    }

    return { ok: true }
  })

export const deleteTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string }) => data)
  .handler(async ({ data }) => {
    const store = await getStore()
    const ticketsDir = getTicketsDir()

    // Find file to delete
    const rows = store.query('allTickets')
    const existing = rows.find(r => r.id === data.ticketId)
    if (!existing) throw new Error(`Ticket ${data.ticketId} not found`)

    // Delete from store
    store.commit(events.ticketDeleted({ id: data.ticketId }))

    // Delete file
    const filepath = path.join(ticketsDir, existing.filename)
    try { fs.unlinkSync(filepath) } catch { /* may not exist */ }

    return { ok: true }
  })
