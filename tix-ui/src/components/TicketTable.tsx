import type { Ticket, GroupBy, TicketStatus } from '#/lib/types'
import { STATUS_LABELS, STATUS_COLORS } from '#/lib/types'
import { Badge } from './ui'
import { StatusIcon } from './icons/StatusIcon'
import { PriorityIcon } from './icons/PriorityIcon'
import { TypeIcon } from './icons/TypeIcon'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { TypeSelector } from './TypeSelector'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useRowHighlight } from '#/lib/hooks/use-row-highlights'
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useDndState } from '#/lib/DndProvider'
import { TicketActions } from './TicketActions'

interface TicketTableProps {
  grouped: Record<string, Ticket[]>
  groupBy: GroupBy
  onUpdate?: (ticketId: string, updates: Record<string, any>) => void
  /** When provided, called instead of navigating to the full route on row click. */
  onRowClick?: (ticketId: string) => void
  /** Currently selected row id (highlighted when shown in side panel). */
  selectedId?: string | null
}

const priorityLabels: Record<string, string> = {
  '0': 'P0 Urgent', '1': 'P1 High', '2': 'P2 Medium', '3': 'P3 Low', '4': 'P4 None',
}

function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'status') return STATUS_LABELS[key as TicketStatus] || key
  if (groupBy === 'priority') return priorityLabels[key] || `P${key}`
  if (groupBy === 'type') return key.charAt(0).toUpperCase() + key.slice(1)
  if (groupBy === 'folder') return key || '(root)'
  return key
}

function groupColor(key: string, groupBy: GroupBy): string {
  if (groupBy === 'status') return STATUS_COLORS[key as TicketStatus] || '#94a3b8'
  return '#94a3b8'
}

// Persist collapsed group keys per-groupBy in localStorage so the state
// survives reloads and switching between groupings.
const COLLAPSE_STORAGE_KEY = 'tix-ui:collapsed-groups'

function loadCollapsed(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsed(state: Record<string, string[]>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export function TicketTable({ grouped, groupBy, onUpdate, onRowClick, selectedId }: TicketTableProps) {
  const navigate = useNavigate()

  const openTicket = (id: string) => {
    if (onRowClick) onRowClick(id)
    else navigate({ to: '/ticket/$ticketId', params: { ticketId: id } })
  }

  // Suppress entry animations for the initial data load (be2c).
  // Once rows have rendered at least once, allow subsequent additions to animate in.
  const initialLoadDone = useRef(false)
  const totalRows = useMemo(() => Object.values(grouped).reduce((s, g) => s + g.length, 0), [grouped])
  useEffect(() => {
    if (totalRows > 0) initialLoadDone.current = true
  }, [totalRows])

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  // Load persisted state when groupBy changes.
  useEffect(() => {
    const all = loadCollapsed()
    setCollapsed(new Set(all[groupBy] || []))
  }, [groupBy])

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const all = loadCollapsed()
      all[groupBy] = Array.from(next)
      saveCollapsed(all)
      return next
    })
  }

  const orderedGroups = useMemo(() => {
    const keys = Object.keys(grouped)
    if (groupBy === 'status') {
      const order = ['open', 'in-progress', 'review', 'on-hold', 'done', 'closed']
      return order.filter(k => keys.includes(k))
    }
    if (groupBy === 'priority') {
      return ['0', '1', '2', '3', '4'].filter(k => keys.includes(k))
    }
    return keys.sort()
  }, [grouped, groupBy])

  return (
    <LayoutGroup>
      <div className="w-full" style={{ containerType: 'inline-size' }}>
        {orderedGroups.map(groupKey => (
          <div key={groupKey}>
            {groupBy !== 'none' && (
              <DroppableGroupHeader
                groupKey={groupKey}
                groupBy={groupBy}
                count={grouped[groupKey]?.length ?? 0}
                collapsed={collapsed.has(groupKey)}
                onToggle={() => toggleGroup(groupKey)}
              />
            )}

            <DroppableGroupBody groupKey={groupKey} groupBy={groupBy}>
              <AnimatePresence initial={false}>
                {!collapsed.has(groupKey) && (grouped[groupKey] || []).map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    selected={selectedId === ticket.id}
                    onOpen={openTicket}
                    onUpdate={onUpdate}
                    animate={initialLoadDone.current}
                  />
                ))}
              </AnimatePresence>
            </DroppableGroupBody>
          </div>
        ))}
      </div>
    </LayoutGroup>
  )
}

function DroppableGroupHeader({ groupKey, groupBy, count, collapsed, onToggle }: {
  groupKey: string
  groupBy: GroupBy
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  const droppableId = groupBy !== 'none' && groupBy !== 'folder' ? `group-${groupBy}:${groupKey}` : undefined
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId || `_group_${groupKey}`,
    disabled: !droppableId,
  })
  const { overTarget } = useDndState()
  const crossHighlight = !isOver && overTarget && groupBy !== 'none' && groupBy !== 'folder' && overTarget.dimension === groupBy && overTarget.value === groupKey
  const highlighted = isOver || crossHighlight

  return (
    <div
      ref={setNodeRef}
      className={`sticky top-0 z-10 w-full h-10 flex items-center justify-between px-6 bg-background cursor-pointer select-none transition-colors ${
        highlighted ? 'ring-1 ring-primary/40 bg-primary/10' : ''
      }`}
      style={!highlighted ? { backgroundColor: `color-mix(in srgb, ${groupColor(groupKey, groupBy)} 6%, var(--background))` } : undefined}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      aria-expanded={!collapsed}
    >
      <div className="flex items-center gap-2">
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        {groupBy === 'status' && <StatusIcon status={groupKey} />}
        {groupBy === 'priority' && <PriorityIcon priority={Number(groupKey)} size={14} />}
        {groupBy === 'type' && <TypeIcon type={groupKey} size={14} />}
        <span className="text-sm font-medium">{groupLabel(groupKey, groupBy)}</span>
        <span className="text-sm text-muted-foreground">{count}</span>
      </div>
    </div>
  )
}

function DroppableGroupBody({ groupKey, groupBy, children }: {
  groupKey: string
  groupBy: GroupBy
  children: React.ReactNode
}) {
  const droppableId = groupBy !== 'none' && groupBy !== 'folder' ? `group-${groupBy}-body:${groupKey}` : undefined
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId || `_body_${groupKey}`,
    disabled: !droppableId,
  })

  return (
    <div ref={setNodeRef} className={`transition-colors ${isOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/30 rounded-sm' : ''}`}>
      {children}
    </div>
  )
}

interface TicketRowProps {
  ticket: Ticket
  selected: boolean
  onOpen: (id: string) => void
  onUpdate?: (ticketId: string, updates: Record<string, any>) => void
  /** When false, skip entry/exit/layout animations (used for initial data load). */
  animate?: boolean
}

function TicketRow({ ticket, selected, onOpen, onUpdate, animate = true }: TicketRowProps) {
  const highlightGen = useRowHighlight(ticket.id)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: ticket.id,
  })
  const { activeTicket } = useDndState()

  return (
    <motion.div
      layoutId={`ticket-row-${ticket.id}`}
      layout="position"
      data-ticket-row={ticket.id}
      className={`group relative w-full flex items-center justify-start h-11 px-6 cursor-pointer outline-none focus:outline-none ${selected ? 'bg-accent' : 'hover:bg-accent/50'} bg-background ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => !activeTicket && onOpen(ticket.id)}
      role="button"
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 30 },
      }}
      whileHover={{ backgroundColor: undefined }}
      style={{ zIndex: 1 }}
      onLayoutAnimationStart={animate ? () => {
        const el = document.querySelector(`[data-ticket-row="${ticket.id}"]`) as HTMLElement | null
        if (el) {
          el.style.zIndex = '20'
          el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
          el.style.borderRadius = '4px'
        }
      } : undefined}
      onLayoutAnimationComplete={animate ? () => {
        const el = document.querySelector(`[data-ticket-row="${ticket.id}"]`) as HTMLElement | null
        if (el) {
          el.style.zIndex = '1'
          el.style.boxShadow = ''
          el.style.borderRadius = ''
        }
      } : undefined}
      initial={animate ? { opacity: 0, y: -4 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={animate ? { opacity: 0, y: 4, transition: { duration: 0.15 } } : undefined}
    >
      {highlightGen > 0 && (
        <div
          key={highlightGen}
          className="absolute inset-0 anim-row-highlight pointer-events-none rounded-sm"
        />
      )}
      <span
        ref={setDragRef}
        className="w-6 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground"
        {...listeners}
        {...attributes}
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="w-8 shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <PrioritySelector
          priority={ticket.priority}
          onSelect={(p) => onUpdate?.(ticket.id, { priority: p })}
          compact
        />
      </span>
      <span className="w-14 shrink-0 text-sm hidden sm:inline-block text-muted-foreground font-medium font-mono truncate">
        {ticket.id}
      </span>
      <span className="w-8 shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <StatusSelector
          status={ticket.status}
          onSelect={(s) => onUpdate?.(ticket.id, { status: s })}
          compact
        />
      </span>
      <span className="min-w-0 truncate text-xs sm:text-sm font-medium sm:font-semibold" style={{ flex: '1 1 auto', minWidth: '4rem' }}>
        {ticket.title}
      </span>
      {/* Tags — overlap like stacked cards when space is tight */}
      {ticket.tags.length > 0 && (
        <div className="hidden sm:flex items-center ml-2 overflow-visible tix-tag-cell">
          {ticket.tags.slice(0, 3).map((tag, i) => (
            <Badge key={tag} variant="outline"
              className="text-[10px] px-1.5 py-0 rounded-md bg-background border-border truncate max-w-20 shrink"
              style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: i + 1 }}
            >{tag}</Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 ml-1 shrink-0">
        <span className="hidden sm:flex shrink-0 items-center justify-center" onClick={e => e.stopPropagation()}>
          <TypeSelector
            type={ticket.type}
            onSelect={(t) => onUpdate?.(ticket.id, { type: t })}
            compact
          />
        </span>
        {ticket.assignee ? (
          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0" title={ticket.assignee}>
            {ticket.assignee.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 shrink-0" />
        )}
        {ticket.created && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline-block text-right">
            {new Date(ticket.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <TicketActions ticket={ticket} />
        </span>
      </div>
    </motion.div>
  )
}
