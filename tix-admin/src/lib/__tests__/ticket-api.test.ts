import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import matter from 'gray-matter'
import { handleTicketUpdate } from '../ticket-api'

let counter = 0
function setupTicketDir(id?: string, title?: string): { dir: string, id: string, file: string } {
  const tid = id || `t${String(++counter).padStart(3, '0')}`
  const t = title || 'Test Ticket'
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tix-test-${tid}-`))
  const file = `${t} (${tid}).md`
  fs.writeFileSync(path.join(dir, file), `---
id: ${tid}
title: "${t}"
status: "open"
deps: []
links: []
created: 2026-01-01T00:00:00Z
type: bug
priority: 2
assignee: "Winston"
tags: ["backend"]
---
# ${t}

Original body content.
`)
  return { dir, id: tid, file }
}

/** Find the ticket file in dir by ID */
function findTicketFile(dir: string, id: string): string {
  const f = fs.readdirSync(dir).find(f => f.includes(`(${id})`))
  if (!f) throw new Error(`No file for ${id}`)
  return f
}

describe('handleTicketUpdate', () => {
  it('updates status', async () => {
    const { dir, id } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { status: 'in-progress' })
    expect(result.ok).toBe(true)
    const file = findTicketFile(dir, id)
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.status).toBe('in-progress')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates title, renames file, and syncs body heading', async () => {
    const { dir, id, file: oldFile } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { title: 'Fix Login Bug' })
    expect(result.ok).toBe(true)

    // Old file should be gone
    expect(fs.existsSync(path.join(dir, oldFile))).toBe(false)

    // New file should exist with sanitized title
    const newFile = findTicketFile(dir, id)
    expect(newFile).toBe(`Fix Login Bug (${id}).md`)

    const { data, content } = matter(fs.readFileSync(path.join(dir, newFile), 'utf-8'))
    expect(data.title).toBe('Fix Login Bug')
    expect(content).toMatch(/^# Fix Login Bug/)
    expect(content).toContain('Original body content.')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates body', async () => {
    const { dir, id } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { body: '\n# Updated\n\nNew body.\n' })
    expect(result.ok).toBe(true)
    const file = findTicketFile(dir, id)
    const { content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(content).toContain('New body.')
    expect(content).not.toContain('Original body content.')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates multiple fields at once', async () => {
    const { dir, id } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, {
      title: 'New Title',
      priority: 0,
      assignee: 'Alice',
      tags: ['frontend', 'urgent'],
    })
    expect(result.ok).toBe(true)
    const file = findTicketFile(dir, id)
    expect(file).toBe(`New Title (${id}).md`)
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.title).toBe('New Title')
    expect(data.priority).toBe(0)
    expect(data.assignee).toBe('Alice')
    expect(data.tags).toEqual(['frontend', 'urgent'])
    fs.rmSync(dir, { recursive: true })
  })

  it('preserves unchanged fields', async () => {
    const { dir, id } = setupTicketDir()
    await handleTicketUpdate(dir, id, { priority: 0 })
    const file = findTicketFile(dir, id)
    const { data, content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.title).toBe('Test Ticket')
    expect(data.status).toBe('open')
    expect(data.assignee).toBe('Winston')
    expect(content).toContain('Original body content.')
    fs.rmSync(dir, { recursive: true })
  })

  it('syncs body heading when title changes and body has no heading', async () => {
    const tid = `nohead${++counter}`
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tix-test-${tid}-`))
    fs.writeFileSync(path.join(dir, `No Head (${tid}).md`), `---
id: ${tid}
title: "No Head"
status: "open"
deps: []
links: []
created: 2026-01-01T00:00:00Z
type: bug
priority: 2
assignee: ""
tags: []
---
Just some body text without a heading.
`)
    const result = await handleTicketUpdate(dir, tid, { title: 'Now Has Head' })
    expect(result.ok).toBe(true)
    const file = findTicketFile(dir, tid)
    const { content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(content).toMatch(/^# Now Has Head/)
    expect(content).toContain('Just some body text')
    fs.rmSync(dir, { recursive: true })
  })

  it('rejects invalid status', async () => {
    const { dir, id } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { status: 'invalid' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid status')
    fs.rmSync(dir, { recursive: true })
  })

  it('returns error for unknown ticket', async () => {
    const { dir } = setupTicketDir()
    const result = await handleTicketUpdate(dir, 'zzzz', { title: 'Nope' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
    fs.rmSync(dir, { recursive: true })
  })
})
