import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, getTicket, getConfig, searchTickets, updateTicket, createTicket, deleteTicket } from '../server/tickets'
import type { Ticket } from '../types'

import { getTicketCollection } from '../client/ticket-collection'

function getCollection() {
  if (typeof window === 'undefined') return null
  return getTicketCollection()
}

/**
 * All tickets — React Query for SSR, TanStack DB collection for client-side live updates.
 */
export function useTickets() {
  // React Query for SSR + initial hydration
  const queryResult = useQuery({
    queryKey: ['tickets'],
    queryFn: () => getTickets(),
  })

  // On client, subscribe to the TanStack DB collection for live updates
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const collection = getCollection()
    if (!collection) return

    const sub = collection.subscribeChanges(() => {
      setTickets([...collection.state.values()] as Ticket[])
    })

    // Wait for collection to be ready, then mark as live
    const checkReady = () => {
      if (collection.status === 'ready') {
        setTickets([...collection.state.values()] as Ticket[])
        setIsLive(true)
      } else {
        setTimeout(checkReady, 50)
      }
    }
    checkReady()

    return () => sub.unsubscribe()
  }, [])

  if (isLive) {
    return {
      data: tickets,
      isLoading: false,
      isError: false,
      error: null as Error | null,
      refetch: () => {},
    }
  }

  return {
    data: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    refetch: queryResult.refetch,
  }
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
  const { data: tickets } = useTickets()
  const counts: Array<{ folder: string; count: number }> = []
  if (tickets) {
    const map = new Map<string, number>()
    for (const t of tickets) {
      const folder = t.folder || ''
      map.set(folder, (map.get(folder) || 0) + 1)
    }
    for (const [folder, count] of map) {
      counts.push({ folder, count })
    }
  }
  return { data: counts }
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
      queryClient.invalidateQueries({ queryKey: ['ticket'] })
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId: string) => deleteTicket({ data: { ticketId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket'] })
    },
  })
}

export function useCreateTicket() {
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
  })
}
