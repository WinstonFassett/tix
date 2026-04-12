import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, getTicket, getConfig, searchTickets, getFolderCounts, updateTicket, createTicket, deleteTicket } from '../server/tickets'

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: () => getTickets(),
  })
}

export function useTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket({ data: { ticketId: ticketId! } }),
    enabled: !!ticketId,
  })
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTickets({ data: { query, limit: 50 } }),
    enabled: query.length >= 2,
  })
}

export function useFolderCounts() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => getFolderCounts(),
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

export function useDeleteTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId: string) => deleteTicket({ data: { ticketId } }),
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
      tags?: string[]
    }) => {
      return createTicket({ data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
