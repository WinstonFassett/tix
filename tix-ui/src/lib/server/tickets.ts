import { createServerFn } from '@tanstack/react-start'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { execFile } from 'node:child_process'
import type { Ticket } from '../types'

const VALID_STATUSES = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']

function resolveTicketsDir(): string {
  return process.env.TICKETS_DIR
    || path.join(process.env.TIX_WORKSPACE || process.env.TICKET_WORKSPACE || process.cwd(), 'tickets')
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
    const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
    for (const filename of entries) {
      const filepath = path.join(ticketsDir, filename)
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

    const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
    const filename = entries.find(f => f.includes(`(${ticketId})`))

    if (!filename) {
      throw new Error(`Ticket ${ticketId} not found`)
    }

    const filepath = path.join(ticketsDir, filename)
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
      newFilepath = path.join(ticketsDir, newFilename)
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
    const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
    const filename = entries.find(f => f.includes(`(${data.ticketId})`))
    if (!filename) throw new Error(`Ticket ${data.ticketId} not found`)
    fs.unlinkSync(path.join(ticketsDir, filename))
    return { ok: true }
  })
