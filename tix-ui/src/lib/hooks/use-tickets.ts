import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, getTicket, getConfig, searchTickets, updateTicket, createTicket, deleteTicket } from '../server/tickets'
import type { Ticket } from '../types'

import { getTicketCollection, seedTicketCollection } from '../client/ticket-collection'
import { bumpHighlight } from './use-row-highlights'

function getCollection() {
  if (typeof window === 'undefined') return null
  return getTicketCollection()
}

/**
 * All tickets — React Query for SSR, TanStack DB collection for client-side live updates.
 * React Query data shows immediately (SSR hydrated). Once the collection is ready,
 * it takes over for live updates. No blank gap.
 */
export function useTickets() {
  const queryResult = useQuery({
    queryKey: ['tickets'],
    queryFn: () => getTickets(),
  })

  // Seed the collection with SSR data so it doesn't need to re-fetch
  const ssrData = queryResult.data
  useEffect(() => {
    if (ssrData && ssrData.length > 0) {
      seedTicketCollection(ssrData)
    }
  }, [ssrData])

  // Subscribe to collection for live updates
  const [tickets, setTickets] = useState<Ticket[] | null>(null)

  useEffect(() => {
    const collection = getCollection()
    if (!collection) return

    function syncFromCollection() {
      if (collection!.status === 'ready') {
        setTickets([...collection!.state.values()] as Ticket[])
      }
    }

    const sub = collection.subscribeChanges((changes) => {
      for (const change of changes) {
        if (change.key) bumpHighlight(String(change.key))
      }
      syncFromCollection()
    })

    // Check if already ready (no poll — just one check)
    syncFromCollection()

    return () => sub.unsubscribe()
  }, [])

  // Show collection data if available, otherwise React Query data (SSR)
  return {
    data: tickets ?? queryResult.data ?? [],
    isLoading: !tickets && queryResult.isLoading,
    isError: !tickets && queryResult.isError,
    error: !tickets ? queryResult.error : null,
    refetch: () => {},
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
