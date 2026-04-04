import { useTickets, useUpdateTicket } from '@/lib/hooks/use-tickets'
import { TicketDetail } from '@/components/TicketDetail'
import { Button } from '@/components/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useCallback } from 'react'

interface TicketViewProps {
  ticketId: string
}

export function TicketView({ ticketId }: TicketViewProps) {
  const navigate = useNavigate()
  const { data: tickets = [], isLoading } = useTickets()
  const updateMutation = useUpdateTicket()

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

  return <TicketDetail key={ticket.id} ticket={ticket} onUpdate={handleUpdate} />
}
