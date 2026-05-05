import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Ticket } from '#/lib/types'
import { STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS } from '#/lib/types'
import { Button, Input, Dialog } from './ui'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { TypeSelector } from './TypeSelector'
import { MilkdownEditor } from './MilkdownEditor'
import { useTickets, useDeleteTicket } from '#/lib/hooks/use-tickets'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Folder, Trash2, ChevronDown, FilePlus, Pencil } from 'lucide-react'
import { TicketTagsField } from './TicketTagsField'
import { getTicketEvents, type ActivityEvent } from '#/lib/server/activity'

interface TicketDetailBodyProps {
  ticket: Ticket
  onUpdate: (updates: Record<string, any>) => Promise<void> | void
  /** When true, omit the outer max-w wrapper so the body fills its container (panel mode). */
  fillContainer?: boolean
  /** Saving status indicator slot — rendered above the body when provided (panel mode shows this in its own header). */
  onSaveStateChange?: (state: 'idle' | 'saving' | 'saved' | 'error') => void
}

function stripLeadingTitle(body: string): string {
  return body.replace(/^\s*#\s+[^\n]*\n*/, '')
}

export function TicketDetailBody({ ticket, onUpdate, fillContainer = false, onSaveStateChange }: TicketDetailBodyProps) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteTicket()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const serverBody = stripLeadingTitle(ticket.body || '')

  // Track body dirty state for cross-tab sync
  const [bodyKey, setBodyKey] = useState(0)
  const bodyDirtyRef = useRef(false)
  const pendingBodyRef = useRef<string | null>(null)
  const lastServerBodyRef = useRef(serverBody)
  useEffect(() => {
    if (serverBody !== lastServerBodyRef.current) {
      lastServerBodyRef.current = serverBody
      if (!bodyDirtyRef.current) {
        setBodyKey(k => k + 1) // remount editor with new content
      }
    }
  }, [serverBody])

  // Controlled title with dirty tracking — accept server updates unless user is editing
  const [localTitle, setLocalTitle] = useState(ticket.title)
  const [titleDirty, setTitleDirty] = useState(false)
  useEffect(() => {
    if (!titleDirty) setLocalTitle(ticket.title)
  }, [ticket.title, titleDirty])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    onSaveStateChange?.(saveState)
  }, [saveState, onSaveStateChange])

  const saveImmediate = useCallback(async (updates: Record<string, any>) => {
    setSaveState('saving')
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    try {
      await onUpdate(updates)
      setSaveState('saved')
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }, [onUpdate])

  const DEBOUNCE_MS = 2000

  const resetBodyTimer = useCallback(() => {
    if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current)
    if (pendingBodyRef.current !== null) {
      bodyTimerRef.current = setTimeout(() => {
        if (pendingBodyRef.current !== null) {
          saveImmediate({ body: pendingBodyRef.current })
          pendingBodyRef.current = null
        }
      }, DEBOUNCE_MS)
    }
  }, [saveImmediate])

  // Called on every raw DOM input event in the editor (per-keystroke)
  const handleBodyInput = useCallback(() => {
    resetBodyTimer()
  }, [resetBodyTimer])

  // Called on markdownUpdated (after Milkdown's internal 200ms debounce)
  const handleBodyChange = useCallback((body: string) => {
    pendingBodyRef.current = body
    resetBodyTimer()
  }, [resetBodyTimer])

  const saveTitleDebounced = useCallback((title: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveImmediate({ title }), DEBOUNCE_MS)
  }, [saveImmediate])

  function handleFieldChange(field: string, value: any) {
    saveImmediate({ [field]: value })
  }

  // Tags
  const { data: allTickets = [] } = useTickets()
  const [localTags, setLocalTags] = useState<string[]>(() => ticket.tags)
  useEffect(() => {
    setLocalTags(ticket.tags)
  }, [ticket.id, ticket.tags])

  const tagSuggestions = useMemo<string[]>(() => {
    const seen = new Set<string>()
    for (const t of allTickets) for (const tag of t.tags) seen.add(tag)
    return Array.from(seen)
  }, [allTickets])

  const handleTagsChange = useCallback((next: string[]) => {
    setLocalTags(next)
    saveImmediate({ tags: next })
  }, [saveImmediate])

  async function confirmDelete() {
    try {
      await deleteMutation.mutateAsync(ticket.id)
      setShowDeleteConfirm(false)
      navigate({ to: '/' })
    } catch (e: any) {
      console.error('[deleteTicket] failed:', e)
    }
  }

  const innerWrapperClass = fillContainer ? 'py-6 px-6' : 'max-w-3xl mx-auto py-6 px-6'

  return (
    <>
      <div className={innerWrapperClass}>
        <div className="mb-4">
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = '0'
                el.style.height = el.scrollHeight + 'px'
              }
            }}
            className="w-full bg-transparent text-2xl font-bold rounded-md outline-none placeholder:text-muted-foreground -mx-2 px-2 py-1 cursor-text border border-transparent hover:border-border hover:bg-accent/30 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30 transition-colors resize-none overflow-hidden"
            rows={1}
            value={localTitle}
            onChange={(e) => {
              setLocalTitle(e.target.value)
              setTitleDirty(true)
              saveTitleDebounced(e.target.value)
              // Auto-resize
              e.target.style.height = '0'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={() => { setTitleDirty(false); if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; if (localTitle !== ticket.title) saveImmediate({ title: localTitle }) } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur() }}
            placeholder="Ticket title"
            title="Click to edit title"
            aria-label="Ticket title (editable)"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusSelector status={ticket.status} onSelect={(s) => handleFieldChange('status', s)} />
          <PrioritySelector priority={ticket.priority} onSelect={(p) => handleFieldChange('priority', p)} />
          <TypeSelector type={ticket.type} onSelect={(t) => handleFieldChange('type', t)} />
          <AssigneeInput
            assignee={ticket.assignee}
            onCommit={(v) => saveImmediate({ assignee: v })}
          />
          {ticket.folder && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 h-8 text-sm text-muted-foreground hover:bg-accent transition-colors"
              onClick={() => navigate({ to: '/', search: { folder: ticket.folder } })}
              title={`Filter to folder: ${ticket.folder}`}
            >
              <Folder className="h-3.5 w-3.5" />
              {ticket.folder}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {ticket.created && (
              <span className="text-xs text-muted-foreground" title={new Date(ticket.created).toLocaleString()}>
                Created {new Date(ticket.created).toLocaleDateString()}
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete ticket"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-4">
          <span className="text-xs text-muted-foreground shrink-0 mt-2">Tags</span>
          <div className="flex-1 min-w-0">
            <TicketTagsField
              value={localTags}
              onChange={handleTagsChange}
              suggestions={tagSuggestions}
              placeholder="Add a tag..."
            />
          </div>
        </div>

        {ticket.deps.length > 0 && (
          <div className="text-sm mb-2">
            <span className="text-muted-foreground">Dependencies:</span>
            {ticket.deps.map(dep => (
              <a key={dep} href={`#/ticket/${dep}`} className="text-primary underline underline-offset-4 font-mono ml-1" onClick={(e) => { e.preventDefault(); navigate({ to: '/ticket/$ticketId', params: { ticketId: dep } }) }}>{dep}</a>
            ))}
          </div>
        )}

        <hr className="border-border my-4" />

        <div
          className="min-h-50"
          onFocusCapture={() => { bodyDirtyRef.current = true }}
          onBlurCapture={() => {
            bodyDirtyRef.current = false
            if (pendingBodyRef.current !== null) {
              if (bodyTimerRef.current) clearTimeout(bodyTimerRef.current)
              saveImmediate({ body: pendingBodyRef.current })
              pendingBodyRef.current = null
            }
          }}
        >
          <MilkdownEditor
            key={`${ticket.id}-${bodyKey}`}
            defaultValue={serverBody}
            onInput={handleBodyInput}
            onChange={handleBodyChange}
            tickets={allTickets}
            onNavigateTicket={(id) => navigate({ to: '/ticket/$ticketId', params: { ticketId: id } })}
          />
        </div>

        <TicketHistory ticketId={ticket.id} />

      </div>

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} className="sm:max-w-md p-0">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full bg-destructive/10 text-destructive inline-flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Delete this ticket?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-mono">{ticket.id}</span> &middot; {ticket.title}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This permanently deletes the ticket file. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete ticket'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

/** Collapsible per-ticket event history */
function TicketHistory({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false)

  const { data: events = [] } = useQuery({
    queryKey: ['ticket-history', ticketId],
    queryFn: async () => (await getTicketEvents({ data: { ticketId } })) as ActivityEvent[],
    enabled: open,
  })

  return (
    <div className="mt-6 border-t pt-4">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
        History
        {events.length > 0 && <span className="text-xs">({events.length})</span>}
      </button>
      {open && events.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {events.map(event => (
            <div key={event.eventId} className="flex items-start gap-2 py-1 text-sm">
              <div className="mt-0.5 shrink-0">
                {event.eventName === 'ticket.created'
                  ? <FilePlus className="h-3 w-3 text-green-500" />
                  : <Pencil className="h-3 w-3 text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">
                  {event.eventName === 'ticket.created' ? 'Created' : 'Updated'}
                </span>
                {event.changes && <HistoryChangeSummary changes={event.changes} />}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(event.tsMs).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryChangeSummary({ changes }: { changes: Record<string, unknown> }) {
  const parts: string[] = []
  for (const [key, value] of Object.entries(changes)) {
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
  if (parts.length === 0) return <span className="text-muted-foreground text-xs ml-1">— fields changed</span>
  return <span className="text-muted-foreground text-xs ml-1">— {parts.join(', ')}</span>
}

/** Controlled assignee input — debounce while typing, flush on blur/enter */
function AssigneeInput({ assignee, onCommit }: { assignee: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(assignee)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setLocal(assignee)
  }, [assignee, dirty])
  return (
    <Input
      type="text"
      className="w-40 h-8 text-sm"
      value={local}
      onChange={(e) => { setLocal(e.target.value); setDirty(true) }}
      onBlur={() => { setDirty(false); onCommit(local) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
      placeholder="Assignee"
    />
  )
}
