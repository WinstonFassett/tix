import type { Ticket } from '@/lib/types'
import { Badge, Card } from './ui'
import { StatusIcon } from './icons/StatusIcon'
import { PriorityIcon } from './icons/PriorityIcon'
import { useNavigate } from '@tanstack/react-router'

interface TicketCardProps {
  ticket: Ticket
}

export function TicketCard({ ticket }: TicketCardProps) {
  const navigate = useNavigate()

  return (
    <div className="block cursor-pointer group" onClick={() => navigate({ to: '/ticket/$ticketId', params: { ticketId: ticket.id } })}>
      <Card className="p-3 transition-colors hover:bg-accent/50">
        <div className="flex items-center gap-1.5 mb-1">
          <PriorityIcon priority={ticket.priority} size={14} />
          <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
          <StatusIcon status={ticket.status} size={12} />
        </div>
        <h3 className="text-sm font-medium leading-snug mb-1.5">{ticket.title}</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {ticket.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{tag}</Badge>
          ))}
          {ticket.assignee && (
            <span className="ml-auto w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium" title={ticket.assignee}>
              {ticket.assignee.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}
