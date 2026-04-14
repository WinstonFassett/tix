import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Ticket } from '#/lib/types'
import { STATUSES, type TicketStatus } from '#/lib/types'

interface DndState {
  activeTicket: Ticket | null
}

const DndStateContext = createContext<DndState>({ activeTicket: null })
export function useDndState() { return useContext(DndStateContext) }

interface TicketDndProviderProps {
  children: ReactNode
  tickets: Ticket[]
  /** Called when a ticket is dropped on a status droppable. */
  onStatusChange?: (ticketId: string, status: string) => void
  /** Called when a ticket is dropped on a type droppable. */
  onTypeChange?: (ticketId: string, type: string) => void
  /** Called when a ticket is dropped on a tag droppable. */
  onTagAdd?: (ticketId: string, tag: string) => void
}

export function TicketDndProvider({ children, tickets, onStatusChange, onTypeChange, onTagAdd }: TicketDndProviderProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useSensors(pointerSensor)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    const ticket = tickets.find(t => t.id === id)
    if (ticket) setActiveTicket(ticket)
  }, [tickets])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTicket(null)
    if (!over) return

    const overId = over.id as string
    const ticketId = active.id as string
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return

    // Status drop (kanban columns, sidebar facets, or group headers)
    let targetStatus: string | null = null
    if (overId.startsWith('status:')) targetStatus = overId.slice('status:'.length)
    else if (overId.startsWith('sidebar-status:')) targetStatus = overId.slice('sidebar-status:'.length)
    else if (overId.startsWith('status-body:')) targetStatus = overId.slice('status-body:'.length)

    if (targetStatus && STATUSES.includes(targetStatus as TicketStatus) && ticket.status !== targetStatus) {
      onStatusChange?.(ticketId, targetStatus)
      return
    }

    // Type drop
    if (overId.startsWith('type:')) {
      const targetType = overId.slice('type:'.length)
      if (ticket.type !== targetType) {
        onTypeChange?.(ticketId, targetType)
      }
      return
    }

    // Tag drop — add tag if ticket doesn't already have it
    if (overId.startsWith('tag:')) {
      const tag = overId.slice('tag:'.length)
      if (!ticket.tags.includes(tag)) {
        onTagAdd?.(ticketId, tag)
      }
      return
    }
  }, [tickets, onStatusChange, onTypeChange, onTagAdd])

  return (
    <DndStateContext.Provider value={{ activeTicket }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeTicket && (
            <div className="px-4 py-2 bg-background border rounded-md shadow-xl text-sm font-medium max-w-64 truncate opacity-90">
              {activeTicket.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DndStateContext.Provider>
  )
}
