import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleStatusUpdate } from '../status-api'

describe('handleStatusUpdate', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tix-test-'))
    // Create a test ticket file
    fs.writeFileSync(path.join(tmpDir, 'Fix Bug (a1b2).md'), `---
id: a1b2
title: "Fix Bug"
status: "open"
deps: []
links: []
created: 2026-01-01T00:00:00Z
type: bug
priority: 2
assignee: ""
tags: []
---
# Fix Bug

Some body content.
`)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('updates ticket status in the file', async () => {
    const result = await handleStatusUpdate(tmpDir, 'a1b2', 'in-progress')
    expect(result.ok).toBe(true)

    const content = fs.readFileSync(path.join(tmpDir, 'Fix Bug (a1b2).md'), 'utf-8')
    expect(content).toMatch(/status:\s*in-progress/)
    expect(content).not.toMatch(/status:\s*open/)
  })

  it('returns error for unknown ticket id', async () => {
    const result = await handleStatusUpdate(tmpDir, 'zzzz', 'done')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns error for invalid status', async () => {
    const result = await handleStatusUpdate(tmpDir, 'a1b2', 'invalid')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid status')
  })

  it('preserves other frontmatter fields', async () => {
    await handleStatusUpdate(tmpDir, 'a1b2', 'done')
    const content = fs.readFileSync(path.join(tmpDir, 'Fix Bug (a1b2).md'), 'utf-8')
    expect(content).toMatch(/title:\s*Fix Bug/)
    expect(content).toMatch(/type:\s*bug/)
    expect(content).toContain('# Fix Bug')
  })
})
