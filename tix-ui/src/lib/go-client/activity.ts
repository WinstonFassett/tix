import type { ActivityEvent } from '../server/activity'

const BASE = '/api'

export async function getRecentEvents({ data }: { data: { limit?: number; before?: number } }) {
  const params = new URLSearchParams()
  if (data.limit) params.set('limit', String(data.limit))
  if (data.before) params.set('before', String(data.before))
  const r = await fetch(`${BASE}/events?${params}`)
  if (!r.ok) throw new Error(r.statusText)
  return r.json() as Promise<ActivityEvent[]>
}

export async function getTicketEvents({ data }: { data: { ticketId: string; limit?: number } }) {
  const params = new URLSearchParams()
  if (data.limit) params.set('limit', String(data.limit))
  const r = await fetch(`${BASE}/tickets/${data.ticketId}/events?${params}`)
  if (!r.ok) throw new Error(r.statusText)
  return r.json() as Promise<ActivityEvent[]>
}
