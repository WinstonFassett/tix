import { describe, it, expect } from 'vitest'
import { filterTickets } from '../filter'
import type { Ticket } from '../types'

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: '0001',
    title: 'Test ticket',
    status: 'open',
    deps: [],
    links: [],
    created: '2026-01-01',
    type: 'task',
    priority: 2,
    assignee: '',
    tags: [],
    body: '',
    filename: 'Test Ticket (0001).md',
    ...overrides,
  }
}

describe('filterTickets', () => {
  const tickets: Ticket[] = [
    makeTicket({ id: '0001', title: 'Fix login bug', status: 'open', tags: ['auth'] }),
    makeTicket({ id: '0002', title: 'Add dark mode', status: 'in-progress', tags: ['ui'] }),
    makeTicket({ id: '0003', title: 'Refactor auth', status: 'done', tags: ['auth'] }),
    makeTicket({ id: '0004', title: 'Deploy pipeline', status: 'closed', assignee: 'Winston' }),
  ]

  it('returns all tickets with no filters', () => {
    expect(filterTickets(tickets, {})).toHaveLength(4)
  })

  it('filters by search text (case-insensitive, matches title)', () => {
    expect(filterTickets(tickets, { search: 'auth' })).toHaveLength(2)
    expect(filterTickets(tickets, { search: 'AUTH' })).toHaveLength(2)
  })

  it('filters by search text matching id', () => {
    expect(filterTickets(tickets, { search: '0004' })).toHaveLength(1)
  })

  it('filters by search text matching assignee', () => {
    expect(filterTickets(tickets, { search: 'winston' })).toHaveLength(1)
  })

  it('filters by status', () => {
    expect(filterTickets(tickets, { status: 'open' })).toHaveLength(1)
    expect(filterTickets(tickets, { status: 'in-progress' })).toHaveLength(1)
    expect(filterTickets(tickets, { status: 'done' })).toHaveLength(1)
  })

  it('combines search and status filters', () => {
    expect(filterTickets(tickets, { search: 'auth', status: 'open' })).toHaveLength(1)
    expect(filterTickets(tickets, { search: 'auth', status: 'done' })).toHaveLength(1)
    expect(filterTickets(tickets, { search: 'auth', status: 'closed' })).toHaveLength(0)
  })

  it('returns empty for no matches', () => {
    expect(filterTickets(tickets, { search: 'nonexistent' })).toHaveLength(0)
  })
})
