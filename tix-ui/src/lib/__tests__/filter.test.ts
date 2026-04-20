import { describe, it, expect } from 'vitest'
import type { Ticket } from '../types'
import {
  filterTickets,
  countsByStatus,
  countsByType,
  countsByTag,
  countsByFolder,
  countRootOnly,
} from '../filter'

function mk(id: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title: `Ticket ${id}`,
    status: 'open',
    deps: [],
    created: '2026-01-01T00:00:00Z',
    type: 'task',
    priority: 2,
    assignee: '',
    tags: [],
    body: '',
    filename: `Ticket ${id}.md`,
    folder: '',
    ...overrides,
  }
}

// Spread across root, backend, backend/api, archive, backlog with varied
// statuses/tags/types so each invariant has multiple inputs to cover.
const fixture: Ticket[] = [
  mk('r001', { folder: '', status: 'open', type: 'bug', tags: ['api'] }),
  mk('r002', { folder: '', status: 'closed', type: 'task', tags: ['ui'] }),
  mk('r003', { folder: '', status: 'review', type: 'feature', tags: [] }),
  mk('b001', { folder: 'backend', status: 'open', type: 'bug', tags: ['api', 'db'] }),
  mk('b002', { folder: 'backend', status: 'in-progress', type: 'task', tags: ['api'] }),
  mk('b003', { folder: 'backend', status: 'done', type: 'feature', tags: ['db'] }),
  mk('a001', { folder: 'backend/api', status: 'open', type: 'feature', tags: ['api'] }),
  mk('a002', { folder: 'backend/api', status: 'review', type: 'bug', tags: [] }),
  mk('arc1', { folder: 'archive/2025-12-01', status: 'closed', type: 'task', tags: ['legacy'] }),
  mk('arc2', { folder: 'archive/2025-12-01', status: 'done', type: 'bug', tags: ['legacy'] }),
  mk('bl01', { folder: 'backlog', status: 'open', type: 'feature', tags: ['api'] }),
  mk('bl02', { folder: 'backlog', status: 'on-hold', type: 'task', tags: [] }),
]

const STATUSES = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed'] as const
const TYPES = ['task', 'bug', 'feature', 'epic'] as const

describe('filter count helpers — invariant: count = filtered list length', () => {
  const filterMatrix = [
    { folderScope: '' },
    { folderScope: 'backend' },
    { folderScope: 'backend/api' },
    { folderScope: 'archive/2025-12-01' },
    { folderScope: 'backlog' },
    { folderScope: '', status: 'open' },
    { folderScope: 'backend', status: 'open' },
    { folderScope: 'backend', tag: 'api' },
    { folderScope: 'backend', status: 'open', tag: 'api' },
    { folderScope: '', type: 'bug' },
  ] as const

  for (const filters of filterMatrix) {
    describe(`under filters ${JSON.stringify(filters)}`, () => {
      it('countsByStatus[V] matches filterTickets with status=V', () => {
        const counts = countsByStatus(fixture, filters)
        for (const status of STATUSES) {
          const expected = filterTickets(fixture, { ...filters, status }).length
          expect(counts[status], `status=${status}`).toBe(expected)
        }
      })

      it('countsByType[V] matches filterTickets with type=V', () => {
        const counts = countsByType(fixture, filters)
        for (const type of TYPES) {
          const expected = filterTickets(fixture, { ...filters, type }).length
          expect(counts[type], `type=${type}`).toBe(expected)
        }
      })

      it('countsByTag[V] matches filterTickets with tag=V', () => {
        const counts = new Map(countsByTag(fixture, filters))
        const allTags = new Set(fixture.flatMap(t => t.tags))
        for (const tag of allTags) {
          const expected = filterTickets(fixture, { ...filters, tag }).length
          // countsByTag omits zero-count tags under the current scope; assert
          // equality where a count exists, and absence-implies-zero otherwise.
          if (expected === 0) {
            expect(counts.get(tag) ?? 0, `tag=${tag}`).toBe(0)
          } else {
            expect(counts.get(tag), `tag=${tag}`).toBe(expected)
          }
        }
      })
    })
  }
})

describe('countsByFolder — folder count = list length when navigating to that folder', () => {
  const facetMatrix = [
    {},
    { status: 'open' },
    { tag: 'api' },
    { type: 'bug' },
    { status: 'open', tag: 'api' },
  ] as const

  for (const facets of facetMatrix) {
    it(`invariant holds under ${JSON.stringify(facets)}`, () => {
      const counts = countsByFolder(fixture, facets)
      for (const [folder, n] of counts) {
        const expected = filterTickets(fixture, { ...facets, folderScope: folder }).length
        expect(n, `folder=${folder}`).toBe(expected)
      }
      // Also verify folders not in the map are genuinely zero under these facets.
      const allFolders = new Set(fixture.map(t => t.folder).filter(Boolean))
      for (const f of allFolders) {
        if (!counts.has(f)) {
          const expected = filterTickets(fixture, { ...facets, folderScope: f }).length
          expect(expected, `folder=${f} should be zero if omitted`).toBe(0)
        }
      }
    })
  }
})

describe('countRootOnly — matches root-scope list length', () => {
  for (const facets of [{}, { status: 'open' }, { type: 'bug' }, { tag: 'api' }] as const) {
    it(`under ${JSON.stringify(facets)}`, () => {
      const n = countRootOnly(fixture, facets)
      const expected = filterTickets(fixture, { ...facets, folderScope: '' }).length
      expect(n).toBe(expected)
    })
  }
})

describe('archive and backlog isolation (user-stated scenario)', () => {
  it('archive items never inflate non-archive scopes', () => {
    // At root: no archive items should contribute to any count.
    const rootStatus = countsByStatus(fixture, { folderScope: '' })
    const archiveClosedAtRoot = rootStatus.closed
    // r002 is the only root closed ticket; arc1 is closed but in archive/*.
    expect(archiveClosedAtRoot).toBe(1)
  })

  it('backlog items never inflate root scope counts', () => {
    // bl01 is open in backlog — should not count toward root "open".
    const rootStatus = countsByStatus(fixture, { folderScope: '' })
    // Root open tickets: only r001.
    expect(rootStatus.open).toBe(1)
  })

  it('scoping into archive does surface its items', () => {
    const counts = countsByStatus(fixture, { folderScope: 'archive/2025-12-01' })
    expect(counts.closed).toBe(1)
    expect(counts.done).toBe(1)
    expect(counts.open).toBe(0)
  })
})
