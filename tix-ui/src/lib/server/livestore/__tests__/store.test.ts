import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import matter from 'gray-matter'

// We'll import these once they exist
import { createTicketStore, events, type TicketStore } from '../index.js'
import { hydrateFromFiles, projectTicketToFile } from '../sync.js'

describe('LiveStore ticket store', () => {
  let tmpDir: string
  let store: TicketStore

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tix-test-'))
  })

  afterEach(async () => {
    if (store) await store.shutdown()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a store and queries empty tickets table', async () => {
    store = await createTicketStore({ storageDir: tmpDir })
    const tickets = store.query('allTickets')
    expect(tickets).toEqual([])
  })

  it('materializes a ticket from a ticketCreated event', async () => {
    store = await createTicketStore({ storageDir: tmpDir })

    store.commit(events.ticketCreated({
      id: 'a1b2',
      title: 'Fix the login bug',
      status: 'open',
      type: 'bug',
      priority: 1,
      assignee: 'winston',
      tags: ['auth', 'urgent'],
      deps: [],
      links: ['c3d4'],
      created: '2026-04-11T12:00:00Z',
      body: '# Fix the login bug\n\nUsers can\'t log in.',
      folder: '',
      filename: 'Fix The Login Bug (a1b2).md',
    }))

    const tickets = store.query('allTickets')
    expect(tickets).toHaveLength(1)
    expect(tickets[0]).toMatchObject({
      id: 'a1b2',
      title: 'Fix the login bug',
      status: 'open',
      type: 'bug',
      priority: 1,
      assignee: 'winston',
      body: '# Fix the login bug\n\nUsers can\'t log in.',
      folder: '',
      filename: 'Fix The Login Bug (a1b2).md',
    })
    // tags/deps/links stored as JSON strings
    expect(JSON.parse(tickets[0]!.tags)).toEqual(['auth', 'urgent'])
    expect(JSON.parse(tickets[0]!.deps)).toEqual([])
    expect(JSON.parse(tickets[0]!.links)).toEqual(['c3d4'])
  })

  it('updates ticket fields via ticketUpdated event', async () => {
    store = await createTicketStore({ storageDir: tmpDir })

    store.commit(events.ticketCreated({
      id: 'f00d',
      title: 'Original title',
      status: 'open',
      type: 'task',
      priority: 2,
      assignee: '',
      tags: [],
      deps: [],
      links: [],
      created: '2026-04-11T12:00:00Z',
      body: 'Original body',
      folder: '',
      filename: 'Original Title (f00d).md',
    }))

    // Update multiple fields
    store.commit(events.ticketUpdated({
      id: 'f00d',
      status: 'in-progress',
      priority: 0,
      assignee: 'winston',
      tags: ['backend'],
    }))

    const tickets = store.query('allTickets')
    expect(tickets).toHaveLength(1)
    expect(tickets[0]).toMatchObject({
      id: 'f00d',
      title: 'Original title',        // unchanged
      status: 'in-progress',           // updated
      priority: 0,                     // updated
      assignee: 'winston',             // updated
      body: 'Original body',           // unchanged
    })
    expect(JSON.parse(tickets[0]!.tags)).toEqual(['backend'])
  })

  it('deletes a ticket via ticketDeleted event', async () => {
    store = await createTicketStore({ storageDir: tmpDir })

    store.commit(events.ticketCreated({
      id: 'dead',
      title: 'To be deleted',
      status: 'open',
      type: 'task',
      priority: 2,
      assignee: '',
      tags: [],
      deps: [],
      links: [],
      created: '2026-04-11T12:00:00Z',
      body: '',
      folder: '',
      filename: 'To Be Deleted (dead).md',
    }))

    expect(store.query('allTickets')).toHaveLength(1)

    store.commit(events.ticketDeleted({ id: 'dead' }))

    expect(store.query('allTickets')).toHaveLength(0)
  })

  describe('hydration from .md files', () => {
    function writeTicketFile(dir: string, filename: string, frontmatter: Record<string, unknown>, body: string) {
      const yaml = Object.entries(frontmatter)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${JSON.stringify(i)}`).join('\n')}`
          return `${k}: ${JSON.stringify(v)}`
        })
        .join('\n')
      fs.writeFileSync(path.join(dir, filename), `---\n${yaml}\n---\n${body}`)
    }

    it('hydrates tickets from .md files in a directory', async () => {
      store = await createTicketStore({ storageDir: tmpDir })

      // Create a fake tickets dir with two ticket files
      const ticketsDir = path.join(tmpDir, 'tickets')
      fs.mkdirSync(ticketsDir)

      writeTicketFile(ticketsDir, 'Fix Login (a1b2).md', {
        id: 'a1b2',
        title: 'Fix Login',
        status: 'open',
        type: 'bug',
        priority: 1,
        assignee: 'winston',
        tags: ['auth'],
        deps: [],
        links: [],
        created: '2026-04-11T12:00:00Z',
      }, '# Fix Login\n\nThe login is broken.')

      writeTicketFile(ticketsDir, 'Add Search (c3d4).md', {
        id: 'c3d4',
        title: 'Add Search',
        status: 'in-progress',
        type: 'feature',
        priority: 2,
        assignee: '',
        tags: [],
        deps: ['a1b2'],
        links: [],
        created: '2026-04-11T13:00:00Z',
      }, '# Add Search\n\nFTS5 powered search.')

      // Also a subfolder ticket
      const backlogDir = path.join(ticketsDir, 'backlog')
      fs.mkdirSync(backlogDir)
      writeTicketFile(backlogDir, 'Maybe Later (e5f6).md', {
        id: 'e5f6',
        title: 'Maybe Later',
        status: 'open',
        type: 'task',
        priority: 3,
        assignee: '',
        tags: [],
        deps: [],
        links: [],
        created: '2026-04-11T14:00:00Z',
      }, '# Maybe Later')

      await hydrateFromFiles(store, ticketsDir)

      const tickets = store.query('allTickets')
      expect(tickets).toHaveLength(3)

      const byId = Object.fromEntries(tickets.map(t => [t.id, t]))
      expect(byId['a1b2']).toMatchObject({
        title: 'Fix Login',
        status: 'open',
        body: '# Fix Login\n\nThe login is broken.',
        folder: '',
      })
      expect(byId['c3d4']).toMatchObject({
        title: 'Add Search',
        status: 'in-progress',
        folder: '',
      })
      expect(JSON.parse(byId['c3d4']!.deps)).toEqual(['a1b2'])
      expect(byId['e5f6']).toMatchObject({
        title: 'Maybe Later',
        folder: 'backlog',
        filename: 'backlog/Maybe Later (e5f6).md',
      })
    })
  })

  describe('file projection', () => {
    it('projects a ticket from store state to a .md file', async () => {
      store = await createTicketStore({ storageDir: tmpDir })
      const ticketsDir = path.join(tmpDir, 'tickets')
      fs.mkdirSync(ticketsDir)

      store.commit(events.ticketCreated({
        id: 'beef',
        title: 'Projected Ticket',
        status: 'open',
        type: 'feature',
        priority: 1,
        assignee: 'winston',
        tags: ['test'],
        deps: [],
        links: [],
        created: '2026-04-11T12:00:00Z',
        body: '# Projected Ticket\n\nThis was projected from the store.',
        folder: '',
        filename: 'Projected Ticket (beef).md',
      }))

      const tickets = store.query('allTickets')
      projectTicketToFile(tickets[0]!, ticketsDir)

      const expectedPath = path.join(ticketsDir, 'Projected Ticket (beef).md')
      expect(fs.existsSync(expectedPath)).toBe(true)

      const raw = fs.readFileSync(expectedPath, 'utf-8')
      const { data, content } = matter(raw)
      expect(data.id).toBe('beef')
      expect(data.title).toBe('Projected Ticket')
      expect(data.status).toBe('open')
      expect(data.priority).toBe(1)
      expect(data.tags).toEqual(['test'])
      expect(content.trim()).toBe('# Projected Ticket\n\nThis was projected from the store.')
    })

    it('projects a subfolder ticket into the correct directory', async () => {
      store = await createTicketStore({ storageDir: tmpDir })
      const ticketsDir = path.join(tmpDir, 'tickets')
      fs.mkdirSync(ticketsDir)

      store.commit(events.ticketCreated({
        id: 'cafe',
        title: 'Backlog Item',
        status: 'open',
        type: 'task',
        priority: 3,
        assignee: '',
        tags: [],
        deps: [],
        links: [],
        created: '2026-04-11T12:00:00Z',
        body: '',
        folder: 'backlog',
        filename: 'backlog/Backlog Item (cafe).md',
      }))

      const tickets = store.query('allTickets')
      projectTicketToFile(tickets[0]!, ticketsDir)

      const expectedPath = path.join(ticketsDir, 'backlog', 'Backlog Item (cafe).md')
      expect(fs.existsSync(expectedPath)).toBe(true)
    })
  })

  describe('round-trip stability', () => {
    function writeTicketFile(dir: string, filename: string, frontmatter: Record<string, unknown>, body: string) {
      const yaml = Object.entries(frontmatter)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${JSON.stringify(i)}`).join('\n')}`
          return `${k}: ${JSON.stringify(v)}`
        })
        .join('\n')
      fs.writeFileSync(path.join(dir, filename), `---\n${yaml}\n---\n${body}`)
    }

    it('hydrate → project → re-hydrate produces identical state', async () => {
      store = await createTicketStore({ storageDir: tmpDir })
      const ticketsDir = path.join(tmpDir, 'tickets')
      fs.mkdirSync(ticketsDir)

      // Write original file
      writeTicketFile(ticketsDir, 'Round Trip (abcd).md', {
        id: 'abcd',
        title: 'Round Trip',
        status: 'in-progress',
        type: 'feature',
        priority: 1,
        assignee: 'winston',
        tags: ['test', 'roundtrip'],
        deps: ['1234'],
        links: ['5678'],
        created: '2026-04-11T12:00:00Z',
      }, '# Round Trip\n\nBody with **markdown**.')

      // Hydrate from file
      await hydrateFromFiles(store, ticketsDir)
      const original = store.query('allTickets')
      expect(original).toHaveLength(1)

      // Project back to a new directory
      const outDir = path.join(tmpDir, 'projected')
      fs.mkdirSync(outDir)
      projectTicketToFile(original[0]!, outDir)

      // Create a fresh store, hydrate from projected files
      await store.shutdown()
      const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tix-test2-'))
      const store2 = await createTicketStore({ storageDir: tmpDir2 })

      await hydrateFromFiles(store2, outDir)
      const roundTripped = store2.query('allTickets')

      expect(roundTripped).toHaveLength(1)
      expect(roundTripped[0]!.id).toBe(original[0]!.id)
      expect(roundTripped[0]!.title).toBe(original[0]!.title)
      expect(roundTripped[0]!.status).toBe(original[0]!.status)
      expect(roundTripped[0]!.priority).toBe(original[0]!.priority)
      expect(roundTripped[0]!.body).toBe(original[0]!.body)
      expect(roundTripped[0]!.tags).toBe(original[0]!.tags)
      expect(roundTripped[0]!.deps).toBe(original[0]!.deps)
      expect(roundTripped[0]!.links).toBe(original[0]!.links)

      await store2.shutdown()
      fs.rmSync(tmpDir2, { recursive: true, force: true })
      // Reassign so afterEach doesn't double-shutdown
      store = undefined as any
    })
  })
})
