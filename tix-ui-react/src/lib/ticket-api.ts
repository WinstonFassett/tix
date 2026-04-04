import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const VALID_STATUSES = ['open', 'in-progress', 'on-hold', 'done', 'closed']

export interface TicketUpdate {
  title?: string
  status?: string
  priority?: number
  assignee?: string
  type?: string
  tags?: string[]
  body?: string
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

export async function handleTicketUpdate(
  ticketsDir: string,
  ticketId: string,
  updates: TicketUpdate,
): Promise<{ ok: boolean; error?: string }> {
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return { ok: false, error: `Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}` }
  }

  const entries = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'))
  const filename = entries.find(f => f.includes(`(${ticketId})`))

  if (!filename) {
    return { ok: false, error: `Ticket ${ticketId} not found` }
  }

  const filepath = path.join(ticketsDir, filename)
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  if (updates.title !== undefined) data.title = updates.title
  if (updates.status !== undefined) data.status = updates.status
  if (updates.priority !== undefined) data.priority = updates.priority
  if (updates.assignee !== undefined) data.assignee = updates.assignee
  if (updates.type !== undefined) data.type = updates.type
  if (updates.tags !== undefined) data.tags = updates.tags

  let newContent = updates.body !== undefined ? updates.body : content

  if (updates.title !== undefined) {
    newContent = syncBodyTitle(newContent, updates.title)
  }

  const updated = matter.stringify(newContent, data)

  let newFilepath = filepath
  if (updates.title !== undefined) {
    const cleanTitle = sanitizeTitle(updates.title)
    const newFilename = `${cleanTitle} (${ticketId}).md`
    newFilepath = path.join(ticketsDir, newFilename)
    if (newFilepath !== filepath && fs.existsSync(newFilepath)) {
      return { ok: false, error: `File already exists: ${newFilename}` }
    }
  }

  fs.writeFileSync(newFilepath, updated)

  if (newFilepath !== filepath) {
    fs.unlinkSync(filepath)
  }

  return { ok: true }
}
