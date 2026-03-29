import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const VALID_STATUSES = ['open', 'in-progress', 'done', 'closed']

export async function handleStatusUpdate(
  ticketsDir: string,
  ticketId: string,
  newStatus: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_STATUSES.includes(newStatus)) {
    return { ok: false, error: `Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}` }
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

  data.status = newStatus

  const updated = matter.stringify(content, data)
  fs.writeFileSync(filepath, updated)

  return { ok: true }
}
