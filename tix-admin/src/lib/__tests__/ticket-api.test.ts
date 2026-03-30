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

describe('handleTicketUpdate', () => {
  it('updates status', async () => {
    const { dir, id, file } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { status: 'in-progress' })
    expect(result.ok).toBe(true)
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.status).toBe('in-progress')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates title', async () => {
    const { dir, id, file } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { title: 'Fix Login Bug' })
    expect(result.ok).toBe(true)
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.title).toBe('Fix Login Bug')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates body', async () => {
    const { dir, id, file } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, { body: '\n# Updated\n\nNew body.\n' })
    expect(result.ok).toBe(true)
    const { content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(content).toContain('New body.')
    expect(content).not.toContain('Original body content.')
    fs.rmSync(dir, { recursive: true })
  })

  it('updates multiple fields at once', async () => {
    const { dir, id, file } = setupTicketDir()
    const result = await handleTicketUpdate(dir, id, {
      title: 'New Title',
      priority: 0,
      assignee: 'Alice',
      tags: ['frontend', 'urgent'],
    })
    expect(result.ok).toBe(true)
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.title).toBe('New Title')
    expect(data.priority).toBe(0)
    expect(data.assignee).toBe('Alice')
    expect(data.tags).toEqual(['frontend', 'urgent'])
    fs.rmSync(dir, { recursive: true })
  })

  it('preserves unchanged fields', async () => {
    const { dir, id, file } = setupTicketDir()
    await handleTicketUpdate(dir, id, { priority: 0 })
    const { data, content } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    expect(data.title).toBe('Test Ticket')
    expect(data.status).toBe('open')
    expect(data.assignee).toBe('Winston')
    expect(content).toContain('Original body content.')
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
