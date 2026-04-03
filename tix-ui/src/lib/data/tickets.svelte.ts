import type { Ticket } from '../types'

let tickets = $state<Ticket[]>([])
let loading = $state(true)
let error = $state<string | null>(null)

async function fetchTickets() {
  try {
    const res = await fetch('/api/tickets')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    tickets = await res.json()
    error = null
  } catch (e: any) {
    error = e.message
  } finally {
    loading = false
  }
}

// Group tickets by status for kanban
const byStatus = $derived.by(() => {
  const groups: Record<string, Ticket[]> = {
    'open': [],
    'in-progress': [],
    'done': [],
    'closed': [],
  }
  for (const t of tickets) {
    const key = t.status in groups ? t.status : 'open'
    groups[key].push(t)
  }
  return groups
})

export function useTickets() {
  return {
    get tickets() { return tickets },
    get loading() { return loading },
    get error() { return error },
    get byStatus() { return byStatus },
    refresh: fetchTickets,
  }
}

// Init: fetch on module load + listen for HMR updates
fetchTickets()

if (import.meta.hot) {
  import.meta.hot.on('tickets-update', () => {
    fetchTickets()
  })
}
