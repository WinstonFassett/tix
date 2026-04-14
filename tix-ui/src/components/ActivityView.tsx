import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getRecentEvents, type ActivityEvent } from '#/lib/server/activity'
import { useSidebar } from '#/lib/AppContext'
import { STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS } from '#/lib/types'
import { PanelLeft, Plus, FilePlus, Pencil, Trash2, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui'

export function ActivityView() {
  const { toggle: toggleSidebar } = useSidebar()
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const { isLoading, error } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const events = (await getRecentEvents({ data: { limit: 50 } })) as ActivityEvent[]
      setAllEvents(events)
      return events
    },
  })

  const loadMore = useCallback(async () => {
    if (allEvents.length === 0) return
    setLoadingMore(true)
    try {
      const lastId = allEvents[allEvents.length - 1]!.eventId
      const older = (await getRecentEvents({ data: { limit: 50, before: lastId } })) as ActivityEvent[]
      setAllEvents(prev => [...prev, ...older])
    } finally {
      setLoadingMore(false)
    }
  }, [allEvents])

  // Group events by day
  const grouped = groupByDay(allEvents)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <button
          className="lg:hidden p-1 -ml-1 rounded hover:bg-accent"
          onClick={toggleSidebar}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold">Activity</h1>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading activity...
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-destructive text-sm">
            Failed to load activity
          </div>
        ) : allEvents.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            No activity yet
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-4">
            {grouped.map(([dayLabel, events]) => (
              <div key={dayLabel} className="mb-6">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 sticky top-0 bg-background py-1">
                  {dayLabel}
                </div>
                <div className="space-y-0.5">
                  {events.map(event => (
                    <ActivityRow key={event.eventId} event={event} />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            <div className="flex justify-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-muted-foreground"
              >
                {loadingMore ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 mr-1" />
                )}
                Load older
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const icon = eventIcon(event.eventName)
  const verb = eventVerb(event.eventName)
  const time = formatTime(event.tsMs)

  return (
    <div className="flex items-start gap-3 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0 text-sm">
        <span className="text-muted-foreground">{verb} </span>
        {event.entityId ? (
          <Link
            to="/ticket/$ticketId"
            params={{ ticketId: event.entityId }}
            className="font-medium hover:underline"
          >
            {event.entityTitle || event.entityId}
          </Link>
        ) : (
          <span className="font-medium">{event.entityTitle || 'unknown'}</span>
        )}
        {event.changes && <ChangeSummary changes={event.changes} />}
      </div>
      <span className="text-xs text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {time}
      </span>
    </div>
  )
}

function ChangeSummary({ changes }: { changes: Record<string, unknown> }) {
  const parts: string[] = []

  for (const [key, value] of Object.entries(changes)) {
    // Skip body changes in the summary — too noisy
    if (key === 'body' || key === 'filename') continue

    if (key === 'status' && typeof value === 'string') {
      parts.push(`status → ${STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value}`)
    } else if (key === 'priority' && typeof value === 'number') {
      parts.push(`priority → ${PRIORITY_LABELS[value] ?? value}`)
    } else if (key === 'type' && typeof value === 'string') {
      parts.push(`type → ${TYPE_LABELS[value] ?? value}`)
    } else if (key === 'title' && typeof value === 'string') {
      parts.push(`title → "${value}"`)
    } else if (key === 'assignee' && typeof value === 'string') {
      parts.push(value ? `assigned to ${value}` : 'unassigned')
    } else if (key === 'tags' && Array.isArray(value)) {
      parts.push(`tags → [${value.join(', ')}]`)
    } else {
      parts.push(`${key} changed`)
    }
  }

  if (parts.length === 0) return null

  return (
    <span className="text-muted-foreground text-xs ml-1">
      — {parts.join(', ')}
    </span>
  )
}

function eventIcon(eventName: string) {
  switch (eventName) {
    case 'ticket.created':
      return <FilePlus className="h-3.5 w-3.5 text-green-500" />
    case 'ticket.updated':
      return <Pencil className="h-3.5 w-3.5 text-blue-500" />
    case 'ticket.deleted':
      return <Trash2 className="h-3.5 w-3.5 text-red-500" />
    default:
      return <Plus className="h-3.5 w-3.5" />
  }
}

function eventVerb(eventName: string): string {
  switch (eventName) {
    case 'ticket.created': return 'Created'
    case 'ticket.updated': return 'Updated'
    case 'ticket.deleted': return 'Deleted'
    default: return eventName
  }
}

function formatTime(tsMs: number): string {
  const d = new Date(tsMs)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function groupByDay(events: ActivityEvent[]): [string, ActivityEvent[]][] {
  const groups = new Map<string, ActivityEvent[]>()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const event of events) {
    const d = new Date(event.tsMs)
    let label: string

    if (sameDay(d, today)) {
      label = 'Today'
    } else if (sameDay(d, yesterday)) {
      label = 'Yesterday'
    } else {
      label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    }

    const list = groups.get(label)
    if (list) list.push(event)
    else groups.set(label, [event])
  }

  return [...groups.entries()]
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
