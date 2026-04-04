import type { Ticket, GroupBy, TicketStatus } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS } from '@/lib/types'
import { Badge } from './ui'
import { StatusIcon } from './icons/StatusIcon'
import { PriorityIcon } from './icons/PriorityIcon'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

interface TicketTableProps {
  tickets: Ticket[]
  grouped: Record<string, Ticket[]>
  groupBy: GroupBy
  onUpdate?: (ticketId: string, updates: Record<string, any>) => void
}

const priorityLabels: Record<string, string> = {
  '0': 'P0 Urgent', '1': 'P1 High', '2': 'P2 Medium', '3': 'P3 Low', '4': 'P4 None',
}

function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'status') return STATUS_LABELS[key as TicketStatus] || key
  if (groupBy === 'priority') return priorityLabels[key] || `P${key}`
  if (groupBy === 'type') return key.charAt(0).toUpperCase() + key.slice(1)
  return key
}

function groupColor(key: string, groupBy: GroupBy): string {
  if (groupBy === 'status') return STATUS_COLORS[key as TicketStatus] || '#94a3b8'
  return '#94a3b8'
}

export function TicketTable({ tickets, grouped, groupBy, onUpdate }: TicketTableProps) {
  const navigate = useNavigate()

  const orderedGroups = useMemo(() => {
    const keys = Object.keys(grouped)
    if (groupBy === 'status') {
      const order = ['open', 'in-progress', 'on-hold', 'done', 'closed']
      return order.filter(k => keys.includes(k))
    }
    if (groupBy === 'priority') {
      return ['0', '1', '2', '3', '4'].filter(k => keys.includes(k))
    }
    return keys.sort()
  }, [grouped, groupBy])

  return (
    <div className="w-full">
      {orderedGroups.map(groupKey => (
        <div key={groupKey}>
          {groupBy !== 'none' && (
            <div
              className="sticky top-0 z-10 w-full h-10 flex items-center justify-between px-6"
              style={{ backgroundColor: `${groupColor(groupKey, groupBy)}08` }}
            >
              <div className="flex items-center gap-2">
                {groupBy === 'status' && <StatusIcon status={groupKey} />}
                {groupBy === 'priority' && <PriorityIcon priority={Number(groupKey)} size={14} />}
                <span className="text-sm font-medium">{groupLabel(groupKey, groupBy)}</span>
                <span className="text-sm text-muted-foreground">{grouped[groupKey]?.length}</span>
              </div>
            </div>
          )}

          {(grouped[groupKey] || []).map(ticket => (
            <div
              key={ticket.id}
              className="w-full flex items-center justify-start h-11 px-6 hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => navigate({ to: '/ticket/$ticketId', params: { ticketId: ticket.id } })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate({ to: '/ticket/$ticketId', params: { ticketId: ticket.id } }) }}
            >
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
              <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-medium sm:font-semibold">
                {ticket.title}
              </span>
              <div className="flex items-center justify-end gap-2 ml-2 shrink-0">
                <div className="items-center justify-end hidden sm:flex gap-1">
                  {ticket.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{tag}</Badge>
                  ))}
                </div>
                {ticket.created && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline-block w-16 text-right">
                    {new Date(ticket.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {ticket.assignee ? (
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0" title={ticket.assignee}>
                    {ticket.assignee.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
