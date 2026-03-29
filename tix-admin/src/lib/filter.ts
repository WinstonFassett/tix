import type { Ticket } from './types'

export interface FilterOptions {
  search?: string
  status?: string
}

export function filterTickets(tickets: Ticket[], opts: FilterOptions): Ticket[] {
  let result = tickets

  if (opts.status) {
    result = result.filter(t => t.status === opts.status)
  }

  if (opts.search) {
    const q = opts.search.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.assignee.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  return result
}
