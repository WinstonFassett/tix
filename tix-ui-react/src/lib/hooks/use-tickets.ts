import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Ticket } from '../types'

async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch('/api/tickets')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchConfig(): Promise<{ ticketsDir: string }> {
  const res = await fetch('/api/config')
  return res.json()
}

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  })
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, updates }: { ticketId: string; updates: Record<string, any> }) => {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || 'Save failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string
      type?: string
      priority?: number
      assignee?: string
    }) => {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to create ticket')
      return json as { ok: true; id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/** Set up HMR listener to invalidate tickets query on file changes */
export function useTicketsHMR() {
  const queryClient = useQueryClient()

  if (import.meta.hot) {
    import.meta.hot.on('tickets-update', () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    })
  }
}
