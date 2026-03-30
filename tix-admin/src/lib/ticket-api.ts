import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const VALID_STATUSES = ['open', 'in-progress', 'done', 'closed']

export interface TicketUpdate {
  title?: string
  status?: string
  priority?: number
  assignee?: string
  type?: string
  tags?: string[]
  body?: string
}

export async function handleTicketUpdate(
  ticketsDir: string,
  ticketId: string,
  updates: TicketUpdate,
): Promise<{ ok: boolean; error?: string }> {
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return { ok: false, error: `Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}` }
  }

  // Find the ticket file by ID pattern
  const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
  const filename = entries.find(f => f.includes(`(${ticketId})`))

  if (!filename) {
    return { ok: false, error: `Ticket ${ticketId} not found` }
  }

  const filepath = path.join(ticketsDir, filename)
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  // Merge frontmatter fields
  if (updates.title !== undefined) data.title = updates.title
  if (updates.status !== undefined) data.status = updates.status
  if (updates.priority !== undefined) data.priority = updates.priority
  if (updates.assignee !== undefined) data.assignee = updates.assignee
  if (updates.type !== undefined) data.type = updates.type
  if (updates.tags !== undefined) data.tags = updates.tags

  // Use updated body or keep existing
  const newContent = updates.body !== undefined ? updates.body : content

  const updated = matter.stringify(newContent, data)
  fs.writeFileSync(filepath, updated)

  return { ok: true }
}
