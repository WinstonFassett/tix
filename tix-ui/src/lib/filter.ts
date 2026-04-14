import type { Ticket } from './types'

export interface FilterOptions {
  search?: string
  status?: string
  tag?: string
  type?: string
  /** Scoped folder path. Empty/undefined = root (root-level tickets only). */
  folderScope?: string
}

export function filterTickets(tickets: Ticket[], opts: FilterOptions): Ticket[] {
  let result = tickets

  if (opts.folderScope) {
    // Scoped to a specific folder — show only its direct items
    result = result.filter(t => t.folder === opts.folderScope)
  } else {
    // Root view — show only root-level tickets (no folder)
    result = result.filter(t => !t.folder)
  }

  if (opts.status) {
    result = result.filter(t => t.status === opts.status)
  }

  if (opts.tag) {
    result = result.filter(t => t.tags.includes(opts.tag!))
  }

  if (opts.type) {
    result = result.filter(t => t.type === opts.type)
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
