import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { execFile } from 'node:child_process'
import type { Ticket } from '../types'

const VALID_STATUSES = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']
export const DEFAULT_IGNORED_FOLDERS = ['archive']

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
}

/** Recursively walk tickets dir, returning { filepath, filename, folder } tuples.
 *  `folder` is relative to ticketsDir (empty string for root). */
function walkTickets(ticketsDir: string, rel = ''): Array<{ filepath: string; filename: string; folder: string }> {
  const results: Array<{ filepath: string; filename: string; folder: string }> = []
  const dir = rel ? path.join(ticketsDir, rel) : ticketsDir
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      results.push(...walkTickets(ticketsDir, childRel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        filepath: path.join(dir, entry.name),
        filename: rel ? `${rel}/${entry.name}` : entry.name,
        folder: rel,
      })
    }
  }
  return results
}

/** Find a single ticket file by ID anywhere in the tree (including ignored folders). */
function findTicketFile(ticketsDir: string, ticketId: string): { filepath: string; filename: string; folder: string } | null {
  const all = walkTickets(ticketsDir)
  return all.find(f => f.filename.includes(`(${ticketId})`)) || null
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

export const getTickets = createServerFn({ method: 'GET' }).handler(async () => {
  const ticketsDir = resolveTicketsDir()
  const tickets: Ticket[] = []

  try {
    const files = walkTickets(ticketsDir)
    for (const { filepath, filename, folder } of files) {
      const raw = fs.readFileSync(filepath, 'utf-8')
      const { data, content } = matter(raw)
      tickets.push({
        id: String(data.id || ''),
        title: data.title || '',
        status: (data.status || 'open') as Ticket['status'],
        deps: data.deps || [],
        links: data.links || [],
        created: data.created || '',
        type: data.type || '',
        priority: data.priority ?? 2,
        assignee: data.assignee || '',
        tags: data.tags || [],
        body: content.trim(),
        filename,
        folder,
      })
    }
  } catch {
    // tickets dir may not exist yet
  }

  return tickets
})

export const getConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const ticketsDir = resolveTicketsDir()
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

    const args = ['create', title]
    if (description) args.push('-d', description)
    if (type) args.push('--type', type)
    if (priority !== undefined) args.push('--priority', String(priority))
    if (assignee) args.push('--assignee', assignee)
    if (tags && tags.length > 0) {
      for (const t of tags) args.push('--tag', t)
    }

    const workspace = process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd()

    const result = await new Promise<{ ok: true; id: string | null; output: string }>((resolve, reject) => {
      execFile('tix', args, { cwd: workspace }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message))
        } else {
          const idMatch = stdout.match(/([a-f0-9]{4})/)
          resolve({ ok: true, id: idMatch?.[1] || null, output: stdout.trim() })
        }
      })
    })

    return result
  })

export const updateTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string; updates: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const { ticketId, updates } = data
    const ticketsDir = resolveTicketsDir()

    if (updates.status && typeof updates.status === 'string' && !VALID_STATUSES.includes(updates.status)) {
      throw new Error(`Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}`)
    }

    const found = findTicketFile(ticketsDir, ticketId)
    if (!found) {
      throw new Error(`Ticket ${ticketId} not found`)
    }

    const { filepath, folder } = found
    const raw = fs.readFileSync(filepath, 'utf-8')
    const { data: frontmatter, content } = matter(raw)

    if (updates.title !== undefined) frontmatter.title = updates.title
    if (updates.status !== undefined) frontmatter.status = updates.status
    if (updates.priority !== undefined) frontmatter.priority = updates.priority
    if (updates.assignee !== undefined) frontmatter.assignee = updates.assignee
    if (updates.type !== undefined) frontmatter.type = updates.type
    if (updates.tags !== undefined) frontmatter.tags = updates.tags

    let newContent = updates.body !== undefined ? (updates.body as string) : content

    if (updates.title !== undefined) {
      newContent = syncBodyTitle(newContent, updates.title as string)
    }

    const updated = matter.stringify(newContent, frontmatter)

    let newFilepath = filepath
    if (updates.title !== undefined) {
      const cleanTitle = sanitizeTitle(updates.title as string)
      const newFilename = `${cleanTitle} (${ticketId}).md`
      const fileDir = folder ? path.join(ticketsDir, folder) : ticketsDir
      newFilepath = path.join(fileDir, newFilename)
      if (newFilepath !== filepath && fs.existsSync(newFilepath)) {
        throw new Error(`File already exists: ${newFilename}`)
      }
    }

    fs.writeFileSync(newFilepath, updated)

    if (newFilepath !== filepath) {
      fs.unlinkSync(filepath)
    }

    return { ok: true }
  })

export const deleteTicket = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string }) => data)
  .handler(async ({ data }) => {
    const ticketsDir = resolveTicketsDir()
    const found = findTicketFile(ticketsDir, data.ticketId)
    if (!found) throw new Error(`Ticket ${data.ticketId} not found`)
    fs.unlinkSync(found.filepath)
    return { ok: true }
  })
