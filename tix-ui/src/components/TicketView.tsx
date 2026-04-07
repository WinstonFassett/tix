import { useTickets, useUpdateTicket } from '#/lib/hooks/use-tickets'
import { TicketDetail } from '#/components/TicketDetail'
import { Button } from '#/components/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useFilters, useViewSettings } from '#/lib/AppContext'
import { filterTickets } from '#/lib/filter'
import type { Ticket } from '#/lib/types'

interface TicketViewProps {
  ticketId: string
}

export function TicketView({ ticketId }: TicketViewProps) {
  const navigate = useNavigate()
  const { data: tickets = [], isLoading } = useTickets()
  const updateMutation = useUpdateTicket()
  const filters = useFilters()
  const view = useViewSettings()

  // Mirror DashboardView's filter + sort so the pager walks the same list
  // the user saw before clicking in.
  const sortedList = useMemo(() => {
    const filtered = filterTickets(tickets, {
      status: filters.statusFilter || undefined,
      tag: filters.tagFilter || undefined,
      type: filters.typeFilter || undefined,
    })
    const dir = view.sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[view.sortBy as keyof Ticket]
      const bv = b[view.sortBy as keyof Ticket]
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [tickets, filters.statusFilter, filters.tagFilter, filters.typeFilter, view.sortBy, view.sortDir])

  // If the current ticket is not in the filtered list (e.g. you navigated
  // directly by URL) fall back to the full list so pager still works.
  const pagerList = useMemo(() => {
    if (sortedList.some(t => String(t.id) === ticketId)) return sortedList
    return tickets
  }, [sortedList, tickets, ticketId])

  const currentIndex = useMemo(
    () => pagerList.findIndex(t => String(t.id) === ticketId),
    [pagerList, ticketId],
  )
  const prevId = currentIndex > 0 ? pagerList[currentIndex - 1]!.id : null
  const nextId = currentIndex >= 0 && currentIndex < pagerList.length - 1 ? pagerList[currentIndex + 1]!.id : null

  const goPrev = useCallback(() => {
    if (prevId) navigate({ to: '/ticket/$ticketId', params: { ticketId: prevId } })
  }, [prevId, navigate])
  const goNext = useCallback(() => {
    if (nextId) navigate({ to: '/ticket/$ticketId', params: { ticketId: nextId } })
  }, [nextId, navigate])

  const ticket = tickets.find(t => String(t.id) === ticketId)

  const handleUpdate = useCallback(async (updates: Record<string, any>) => {
    await updateMutation.mutateAsync({ ticketId, updates })
  }, [ticketId, updateMutation])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <>
        <div className="w-full flex items-center border-b py-1.5 px-6 h-10">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => navigate({ to: '/' })}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p>Ticket <code className="font-mono">{ticketId}</code> not found</p>
        </div>
      </>
    )
  }

  return (
    <TicketDetail
      key={ticket.id}
      ticket={ticket}
      onUpdate={handleUpdate}
      pager={{
        index: currentIndex,
        total: pagerList.length,
        onPrev: prevId ? goPrev : undefined,
        onNext: nextId ? goNext : undefined,
      }}
    />
  )
}
