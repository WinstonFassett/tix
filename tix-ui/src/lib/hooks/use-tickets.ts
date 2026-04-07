import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, getConfig, updateTicket, createTicket } from '../server/tickets'

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: () => getTickets(),
    // Live updates: poll every 2s so that external changes to ticket files
    // (via `tix` CLI, editor saves, etc.) appear without a hard refresh.
    // In vite dev mode the HMR `tickets-update` event (see __root.tsx)
    // provides an additional instant-invalidate path; polling is the
    // production fallback since the Nitro server has no HMR. Regression
    // guarded by e2e/live-update.spec.ts (ticket d0ca).
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  })
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => getConfig(),
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, updates }: { ticketId: string; updates: Record<string, unknown> }) => {
      return updateTicket({ data: { ticketId, updates } })
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
      return createTicket({ data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
