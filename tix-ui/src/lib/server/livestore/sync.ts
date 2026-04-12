import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { events, type TicketStore, type TicketRow } from './index.js'

/** Optional callback to mark a file as recently projected (loop guard). */
let _onProjected: ((filepath: string) => void) | null = null

export function setProjectionGuard(fn: (filepath: string) => void): void {
  _onProjected = fn
}

const TICKET_PATTERN = /\(([0-9a-f]{4})\)\.md$/i

/**
 * Recursively walk a tickets directory, returning file info for each ticket.
 */
function walkTickets(
  ticketsDir: string,
  rel = '',
): Array<{ filepath: string; filename: string; folder: string }> {
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
    } else if (entry.isFile() && TICKET_PATTERN.test(entry.name)) {
      results.push({
        filepath: path.join(dir, entry.name),
        filename: rel ? `${rel}/${entry.name}` : entry.name,
        folder: rel,
      })
    }
  }
  return results
}

/**
 * Parse a ticket .md file into the shape expected by ticketCreated events.
 */
function parseTicketFile(filepath: string, filename: string, folder: string) {
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)
  return {
    id: String(data.id || ''),
    title: data.title || '',
    status: data.status || 'open',
    type: data.type || 'task',
    priority: data.priority ?? 2,
    assignee: data.assignee || '',
    tags: data.tags || [],
    deps: data.deps || [],
    links: data.links || [],
    created: data.created ? String(data.created) : '',
    body: content.trim(),
    folder,
    filename,
  }
}

/**
 * Project a ticket row from the store to a .md file on disk.
 * Creates subdirectories as needed for folder-based tickets.
 */
export function projectTicketToFile(ticket: TicketRow, ticketsDir: string): string {
  const frontmatter: Record<string, unknown> = {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    deps: JSON.parse(ticket.deps),
    links: JSON.parse(ticket.links),
    created: ticket.created,
    type: ticket.type,
    priority: ticket.priority,
    assignee: ticket.assignee,
    tags: JSON.parse(ticket.tags),
  }

  const targetDir = ticket.folder
    ? path.join(ticketsDir, ticket.folder)
    : ticketsDir

  fs.mkdirSync(targetDir, { recursive: true })

  const filepath = path.join(ticketsDir, ticket.filename)
  const content = matter.stringify(ticket.body, frontmatter)
  fs.writeFileSync(filepath, content)

  if (_onProjected) _onProjected(filepath)

  return filepath
}

/**
 * Hydrate a LiveStore ticket store from .md files on disk.
 * Commits a ticketCreated event for each file found.
 */
export async function hydrateFromFiles(
  store: TicketStore,
  ticketsDir: string,
): Promise<number> {
  const files = walkTickets(ticketsDir)
  let count = 0
  for (const { filepath, filename, folder } of files) {
    const ticket = parseTicketFile(filepath, filename, folder)
    if (ticket.id) {
      store.commit(events.ticketCreated(ticket))
      count++
    }
  }
  return count
}
