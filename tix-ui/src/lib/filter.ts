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

// ── Count helpers (8c8b) ─────────────────────────────────────
// Principle: count N for facet value V in dimension X equals the list length
// when URL has X=V, other filters unchanged. Each helper strips its own
// dimension from the incoming filters before applying the rest, so callers
// can pass the full active-filter state as-is.

export function countsByStatus(
  tickets: Ticket[],
  opts: FilterOptions,
): Record<string, number> {
  const { status: _s, search: _q, ...rest } = opts
  const base = filterTickets(tickets, rest)
  const counts: Record<string, number> = { open: 0, 'in-progress': 0, review: 0, 'on-hold': 0, done: 0, closed: 0 }
  for (const t of base) {
    if (t.status in counts) counts[t.status]!++
  }
  return counts
}

export function countsByType(
  tickets: Ticket[],
  opts: FilterOptions,
): Record<string, number> {
  const { type: _t, search: _q, ...rest } = opts
  const base = filterTickets(tickets, rest)
  const counts: Record<string, number> = { task: 0, bug: 0, feature: 0, epic: 0 }
  for (const ticket of base) {
    if (ticket.type in counts) counts[ticket.type]!++
  }
  return counts
}

export function countsByTag(
  tickets: Ticket[],
  opts: FilterOptions,
): Array<[string, number]> {
  const { tag: _g, search: _q, ...rest } = opts
  const base = filterTickets(tickets, rest)
  const counts: Record<string, number> = {}
  for (const t of base) {
    for (const tag of t.tags) {
      counts[tag] = (counts[tag] || 0) + 1
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

/**
 * Counts by folder path. Direct-match only (non-recursive) to stay aligned
 * with `filterTickets`' exact folderScope semantics. Applies active
 * status/tag/type. Excludes root-level (`!t.folder`) tickets — use
 * `countRootOnly` for that.
 */
export function countsByFolder(
  tickets: Ticket[],
  opts: FilterOptions,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tickets) {
    if (!t.folder) continue
    if (opts.status && t.status !== opts.status) continue
    if (opts.tag && !t.tags.includes(opts.tag)) continue
    if (opts.type && t.type !== opts.type) continue
    counts.set(t.folder, (counts.get(t.folder) || 0) + 1)
  }
  return counts
}

/**
 * Count for the "tickets" root node in the folder tree: items with no folder
 * that match active status/tag/type.
 */
export function countRootOnly(
  tickets: Ticket[],
  opts: FilterOptions,
): number {
  return filterTickets(tickets, { ...opts, folderScope: undefined }).length
}
