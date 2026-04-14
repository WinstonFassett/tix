import type { Ticket, TicketStatus } from '#/lib/types'
import { STATUSES, STATUS_LABELS, STATUS_COLORS } from '#/lib/types'
import { TicketCard } from './TicketCard'
import { StatusIcon } from './icons/StatusIcon'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { useDndState } from '#/lib/DndProvider'

interface KanbanBoardProps {
  byStatus: Record<string, Ticket[]>
  onCardClick?: (id: string) => void
  selectedId?: string | null
}

export function KanbanBoard({ byStatus, onCardClick, selectedId }: KanbanBoardProps) {
  return (
    <div className="flex h-full gap-3 px-3 py-3 overflow-x-auto">
      {STATUSES.map(col => (
        <KanbanColumn
          key={col}
          status={col}
          tickets={byStatus[col] || []}
          onCardClick={onCardClick}
          selectedId={selectedId}
        />
      ))}
    </div>
  )
}

interface KanbanColumnProps {
  status: TicketStatus
  tickets: Ticket[]
  onCardClick?: (id: string) => void
  selectedId?: string | null
}

function KanbanColumn({ status, tickets, onCardClick, selectedId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })

  return (
    <div className="shrink-0 w-72 flex flex-col rounded-md overflow-hidden">
      <div
        className="h-10 flex items-center justify-between px-3 rounded-t-md"
        style={{ backgroundColor: `${STATUS_COLORS[status]}10` }}
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
          <span className="text-sm text-muted-foreground">{tickets.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-2 rounded-b-md transition-colors ${
          isOver ? 'bg-accent/50 ring-2 ring-primary/30 ring-inset' : 'bg-muted/30'
        }`}
      >
        {tickets.map(ticket => (
          <DraggableCard
            key={ticket.id}
            ticket={ticket}
            onClick={onCardClick}
            selected={selectedId === ticket.id}
          />
        ))}
        {!tickets.length && (
          <div className={`text-center text-xs py-8 transition-colors ${
            isOver ? 'text-primary' : 'text-muted-foreground'
          }`}>
            {isOver ? 'Drop here' : 'No tickets'}
          </div>
        )}
      </div>
    </div>
  )
}

interface DraggableCardProps {
  ticket: Ticket
  onClick?: (id: string) => void
  selected?: boolean
}

function DraggableCard({ ticket, onClick, selected }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
  })
  const { activeTicket } = useDndState()

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-30' : ''}
    >
      <TicketCard ticket={ticket} onClick={activeTicket ? undefined : onClick} selected={selected} />
    </div>
  )
}
