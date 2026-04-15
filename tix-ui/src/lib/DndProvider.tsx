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
  type DragOverEvent,
} from '@dnd-kit/core'
import type { Ticket } from '#/lib/types'
import { STATUSES, type TicketStatus } from '#/lib/types'

interface DndState {
  activeTicket: Ticket | null
  /** Parsed drop target value during drag — e.g. { dimension: 'status', value: 'in-progress' } */
  overTarget: { dimension: string; value: string } | null
}

const DndStateContext = createContext<DndState>({ activeTicket: null, overTarget: null })
export function useDndState() { return useContext(DndStateContext) }

interface TicketDndProviderProps {
  children: ReactNode
  tickets: Ticket[]
  /** Called when a ticket is dropped on a status droppable. */
  onStatusChange?: (ticketId: string, status: string) => void
  /** Called when a ticket is dropped on a type droppable. */
  onTypeChange?: (ticketId: string, type: string) => void
  /** Called when a ticket is dropped on a priority droppable. */
  onPriorityChange?: (ticketId: string, priority: number) => void
  /** Called when a ticket is dropped on a tag droppable. */
  onTagAdd?: (ticketId: string, tag: string) => void
  /** Called when a ticket is dropped on a folder droppable. */
  onFolderChange?: (ticketId: string, folder: string) => void
}

/** Parse a droppable ID like "group-status-body:open" into { dimension: 'status', value: 'open' } */
function parseDroppableId(id: string): { dimension: string; value: string } | null {
  // sidebar-status:open, status:open, group-status:open, group-status-body:open → status / open
  // type:task, group-type:task, group-type-body:task → type / task
  // priority:2, group-priority:2, group-priority-body:2 → priority / 2
  // tag:foo → tag / foo
  for (const dim of ['status', 'type', 'priority', 'tag', 'folder']) {
    const patterns = [`sidebar-${dim}:`, `group-${dim}-body:`, `group-${dim}:`, `${dim}:`]
    for (const p of patterns) {
      if (id.startsWith(p)) return { dimension: dim, value: id.slice(p.length) }
    }
  }
  return null
}

export function TicketDndProvider({ children, tickets, onStatusChange, onTypeChange, onPriorityChange, onTagAdd, onFolderChange }: TicketDndProviderProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [overTarget, setOverTarget] = useState<{ dimension: string; value: string } | null>(null)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useSensors(pointerSensor)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    const ticket = tickets.find(t => t.id === id)
    if (ticket) setActiveTicket(ticket)
  }, [tickets])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id
    setOverTarget(overId ? parseDroppableId(String(overId)) : null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTicket(null)
    setOverTarget(null)
    if (!over) return

    const overId = String(over.id)
    const ticketId = String(active.id)
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return

    // Status drop (kanban columns, sidebar facets, or list groups)
    let targetStatus: string | null = null
    if (overId.startsWith('status:')) targetStatus = overId.slice('status:'.length)
    else if (overId.startsWith('sidebar-status:')) targetStatus = overId.slice('sidebar-status:'.length)
    else if (overId.startsWith('group-status:')) targetStatus = overId.slice('group-status:'.length)
    else if (overId.startsWith('group-status-body:')) targetStatus = overId.slice('group-status-body:'.length)

    if (targetStatus && STATUSES.includes(targetStatus as TicketStatus) && ticket.status !== targetStatus) {
      onStatusChange?.(ticketId, targetStatus)
      return
    }

    // Type drop (sidebar, group header, or group body)
    if (overId.startsWith('type:') || overId.startsWith('group-type:') || overId.startsWith('group-type-body:')) {
      const targetType = overId.replace(/^(group-)?type(-body)?:/, '')
      if (ticket.type !== targetType) {
        onTypeChange?.(ticketId, targetType)
      }
      return
    }

    // Priority drop (group header or group body)
    if (overId.startsWith('priority:') || overId.startsWith('group-priority:') || overId.startsWith('group-priority-body:')) {
      const targetPriority = Number(overId.replace(/^(group-)?priority(-body)?:/, ''))
      if (ticket.priority !== targetPriority) {
        onPriorityChange?.(ticketId, targetPriority)
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

    // Folder drop — move ticket to a different folder
    if (overId.startsWith('folder:')) {
      const targetFolder = overId.slice('folder:'.length)
      if ((ticket.folder || '') !== targetFolder) {
        onFolderChange?.(ticketId, targetFolder)
      }
      return
    }
  }, [tickets, onStatusChange, onTypeChange, onPriorityChange, onTagAdd, onFolderChange])

  return (
    <DndStateContext.Provider value={{ activeTicket, overTarget }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
