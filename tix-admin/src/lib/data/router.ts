/** Minimal hash router for tix-admin */

export interface Route {
  view: 'dashboard' | 'ticket'
  ticketId?: string
}

const EMPTY_ROUTE: Route = { view: 'dashboard' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (!path || path === 'dashboard') return { view: 'dashboard' }

  const parts = path.split('/')
  if (parts[0] === 'ticket' && parts[1]) {
    return { view: 'ticket', ticketId: parts[1] }
  }

  return EMPTY_ROUTE
}

export function routeToHash(route: Route): string {
  switch (route.view) {
    case 'dashboard': return '#/'
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
