/**
 * Fetch-based API client for Go server mode.
 * Matches the server function signatures from lib/server/tickets.ts
 * so the existing hooks and components work unchanged.
 */
import type { Ticket } from '../types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path)
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(e.error ?? r.statusText)
  }
  return r.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(e.error ?? r.statusText)
  }
  return r.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(e.error ?? r.statusText)
  }
  return r.json()
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { method: 'DELETE' })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(e.error ?? r.statusText)
  }
  return r.json()
}

export async function getTickets() {
  return get<Ticket[]>('/tickets')
}

export async function getTicket({ data }: { data: { ticketId: string } }) {
  return get<Ticket>(`/tickets/${data.ticketId}`)
}

export async function searchTickets({ data }: { data: { query: string; limit?: number } }) {
  const params = new URLSearchParams({ q: data.query })
  if (data.limit) params.set('limit', String(data.limit))
  return get<Ticket[]>(`/search?${params}`)
}

export async function getConfig() {
  return get<{ ticketsDir: string; workspaceName: string; workspacePath: string }>('/config')
}

export async function createTicket({ data }: {
  data: {
    title: string
    description?: string
    type?: string
    priority?: number
    assignee?: string
    tags?: string[]
  }
}) {
  return post<{ ok: true; id: string }>('/tickets', data)
}

export async function updateTicket({ data }: {
  data: { ticketId: string; updates: Record<string, unknown> }
}) {
  return patch<{ ok: boolean }>(`/tickets/${data.ticketId}`, data.updates)
}

export async function deleteTicket({ data }: { data: { ticketId: string } }) {
  return del<{ ok: boolean }>(`/tickets/${data.ticketId}`)
}

export async function getFolderCounts() {
  const tickets = await getTickets()
  const map = new Map<string, number>()
  for (const t of tickets) {
    const folder = t.folder || ''
    map.set(folder, (map.get(folder) || 0) + 1)
  }
  return Array.from(map.entries()).map(([folder, count]) => ({ folder, count }))
}
