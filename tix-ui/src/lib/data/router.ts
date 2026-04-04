/** Minimal hash router for tix-ui */

export interface Route {
  view: 'dashboard' | 'ticket'
  ticketId?: string
  filter?: { status?: string; tag?: string; type?: string }
}

const EMPTY_ROUTE: Route = { view: 'dashboard' }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')

  if (!path || path === 'dashboard') {
    const filter = parseFilterParams(qs)
    return { view: 'dashboard', filter }
  }

  const parts = path.split('/')
  if (parts[0] === 'ticket' && parts[1]) {
    return { view: 'ticket', ticketId: parts[1] }
  }

  return EMPTY_ROUTE
}

function parseFilterParams(qs?: string): Route['filter'] {
  if (!qs) return undefined
  const params = new URLSearchParams(qs)
  const status = params.get('status') || undefined
  const tag = params.get('tag') || undefined
  const type = params.get('type') || undefined
  if (!status && !tag && !type) return undefined
  return { status, tag, type }
}

export function routeToHash(route: Route): string {
  switch (route.view) {
    case 'dashboard': {
      const params = new URLSearchParams()
      if (route.filter?.status) params.set('status', route.filter.status)
      if (route.filter?.tag) params.set('tag', route.filter.tag)
      if (route.filter?.type) params.set('type', route.filter.type)
      const qs = params.toString()
      return qs ? `#/?${qs}` : '#/'
    }
    case 'ticket': return `#/ticket/${route.ticketId}`
  }
}

export function navigate(route: Route) {
  const hash = routeToHash(route)
  if (location.hash !== hash) {
    location.hash = hash
  }
}

export function currentRoute(): Route {
  return parseHash(location.hash)
}
