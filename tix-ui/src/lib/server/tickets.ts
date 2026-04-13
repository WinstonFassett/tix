import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Ticket } from '../types'
import { getLedger, getTicketsDir } from './sledge/singleton'
import { projectTicketToFile, markAsProjected } from './sledge/sync'
import { notifyTicketChange } from '../../../server/routes/api/tickets-events.get'

const VALID_STATUSES = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']
export const DEFAULT_IGNORED_FOLDERS = ['archive']

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
  const ledger = await getLedger()
  const tickets = await ledger.query('allTickets', {}) as Ticket[]
  return tickets
})

export const getTicket = createServerFn({ method: 'GET' })
  .inputValidator((data: { ticketId: string }) => data)
  .handler(async ({ data }) => {
    const ledger = await getLedger()
    const ticket = await ledger.query('ticketById', { id: data.ticketId }) as Ticket | null
    if (!ticket) throw new Error(`Ticket ${data.ticketId} not found`)
    return ticket
  })

export const searchTickets = createServerFn({ method: 'GET' })
  .inputValidator((data: { query: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const ledger = await getLedger()
    return await ledger.query('search', { query: data.query, limit: data.limit }) as Ticket[]
  })

export const getFolderCounts = createServerFn({ method: 'GET' }).handler(async () => {
  const ledger = await getLedger()
  return await ledger.query('folderCounts', {}) as Array<{ folder: string; count: number }>
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

    const ledger = await getLedger()
    const ticketsDir = getTicketsDir()
    const id = generateId()
    const cleanTitle = sanitizeTitle(title)
    const filename = `${cleanTitle} (${id}).md`
    const body = description || ''
    const created = new Date().toISOString()

    await ledger.emit('ticket.created', {
      id,
      title,
      status: 'open',
      type: type || 'task',
      priority: priority ?? 2,
      assignee: assignee || '',
      tags: tags || [],
      deps: [],
      links: [],
      created,
      body,
      folder: '',
      filename,
    })

    // Project to .md file
    const ticket = await ledger.query('ticketById', { id }) as Ticket | null
    if (ticket) {
      projectTicketToFile(ticket, ticketsDir)
    }

    notifyTicketChange('ticket-upsert', id)
    return { ok: true as const, id, output: `Created ${filename}` }
  })

export const updateTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string; updates: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const { ticketId, updates } = data
    const ledger = await getLedger()
    const ticketsDir = getTicketsDir()

    if (updates.status && typeof updates.status === 'string' && !VALID_STATUSES.includes(updates.status)) {
      throw new Error(`Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}`)
    }

    const existing = await ledger.query('ticketById', { id: ticketId }) as Ticket | null
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

    console.log('[updateTicket] emitting update for', ticketId, Object.keys(eventUpdates))
    await ledger.emit('ticket.updated', eventUpdates)
    console.log('[updateTicket] emit done, projecting file')

    // Project updated ticket to file
    const updatedTicket = await ledger.query('ticketById', { id: ticketId }) as Ticket | null
    if (updatedTicket) {
      projectTicketToFile(updatedTicket, ticketsDir)
      // Clean up old file if renamed — mark it so chokidar skips the unlink
      if (updatedTicket.filename !== oldFilename) {
        const oldPath = path.join(ticketsDir, oldFilename)
        markAsProjected(oldPath, '__deleted__')
        try { fs.unlinkSync(oldPath) } catch { /* may not exist */ }
      }
    }

    notifyTicketChange('ticket-upsert', ticketId)
    return { ok: true }
  })

export const deleteTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string }) => data)
  .handler(async ({ data }) => {
    const ledger = await getLedger()
    const ticketsDir = getTicketsDir()

    const existing = await ledger.query('ticketById', { id: data.ticketId }) as Ticket | null
    if (!existing) throw new Error(`Ticket ${data.ticketId} not found`)

    await ledger.emit('ticket.deleted', { id: data.ticketId })

    // Delete file
    const filepath = path.join(ticketsDir, existing.filename)
    markAsProjected(filepath, '__deleted__')
    try { fs.unlinkSync(filepath) } catch { /* may not exist */ }

    notifyTicketChange('ticket-delete', data.ticketId)
    return { ok: true }
  })
