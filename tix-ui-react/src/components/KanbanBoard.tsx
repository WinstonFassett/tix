import type { Ticket, TicketStatus } from '@/lib/types'
import { STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { TicketCard } from './TicketCard'
import { StatusIcon } from './icons/StatusIcon'

interface KanbanBoardProps {
  byStatus: Record<string, Ticket[]>
}

export function KanbanBoard({ byStatus }: KanbanBoardProps) {
  return (
    <div className="flex h-full gap-3 px-3 py-3 overflow-x-auto">
      {STATUSES.map(col => (
        <div key={col} className="shrink-0 w-72 flex flex-col rounded-md overflow-hidden">
          <div
            className="h-10 flex items-center justify-between px-3 rounded-t-md"
            style={{ backgroundColor: `${STATUS_COLORS[col]}10` }}
          >
            <div className="flex items-center gap-2">
              <StatusIcon status={col} />
              <span className="text-sm font-medium">{STATUS_LABELS[col]}</span>
              <span className="text-sm text-muted-foreground">{byStatus[col]?.length || 0}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/30 rounded-b-md">
            {(byStatus[col] || []).map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
            {!byStatus[col]?.length && (
              <div className="text-center text-xs text-muted-foreground py-8">No tickets</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
