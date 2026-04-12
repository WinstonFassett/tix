import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Ticket } from '#/lib/types'
import { Button, Input, Dialog } from './ui'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { TypeSelector } from './TypeSelector'
import { MilkdownEditor } from './MilkdownEditor'
import { useTickets, useDeleteTicket } from '#/lib/hooks/use-tickets'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Folder, Trash2 } from 'lucide-react'
import { useFilters } from '#/lib/AppContext'
import { TicketTagsField } from './TicketTagsField'

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
  const filters = useFilters()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayBody = stripLeadingTitle(ticket.body || '')

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    onSaveStateChange?.(saveState)
  }, [saveState, onSaveStateChange])

  const save = useCallback((updates: Record<string, any>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('saving')
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await onUpdate(updates)
        setSaveState('saved')
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('error')
      }
    }, 1000)
  }, [onUpdate])

  function handleFieldChange(field: string, value: any) {
    save({ [field]: value })
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
    save({ tags: next })
  }, [save])

  async function confirmDelete() {
    try {
      await deleteMutation.mutateAsync(ticket.id)
      setShowDeleteConfirm(false)
      navigate({ to: '/' })
    } catch (e: any) {
      alert(`Delete failed: ${e?.message || 'Unknown error'}`)
    }
  }

  const innerWrapperClass = fillContainer ? 'py-6 px-6' : 'max-w-3xl mx-auto py-6 px-6'

  return (
    <>
      <div className={innerWrapperClass}>
        <div className="mb-4">
          <input
            type="text"
            className="w-full bg-transparent text-2xl font-bold rounded-md outline-none placeholder:text-muted-foreground -mx-2 px-2 py-1 cursor-text border border-transparent hover:border-border hover:bg-accent/30 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30 transition-colors"
            defaultValue={ticket.title}
            key={ticket.id}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Ticket title"
            title="Click to edit title"
            aria-label="Ticket title (editable)"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusSelector status={ticket.status} onSelect={(s) => handleFieldChange('status', s)} />
          <PrioritySelector priority={ticket.priority} onSelect={(p) => handleFieldChange('priority', p)} />
          <TypeSelector type={ticket.type} onSelect={(t) => handleFieldChange('type', t)} />
          <Input
            type="text"
            className="w-40 h-8 text-sm"
            defaultValue={ticket.assignee}
            key={`assignee-${ticket.id}`}
            onChange={(e) => handleFieldChange('assignee', e.target.value)}
            placeholder="Assignee"
          />
          {ticket.folder && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 h-8 text-sm text-muted-foreground hover:bg-accent transition-colors"
              onClick={() => filters.setFolderScope(ticket.folder)}
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

        {ticket.links.length > 0 && (
          <div className="text-sm mb-2">
            <span className="text-muted-foreground">Links:</span>
            {ticket.links.map(link => (
              <a key={link} href={`#/ticket/${link}`} className="text-primary underline underline-offset-4 font-mono ml-1" onClick={(e) => { e.preventDefault(); navigate({ to: '/ticket/$ticketId', params: { ticketId: link } }) }}>{link}</a>
            ))}
          </div>
        )}

        <hr className="border-border my-4" />

        <div className="min-h-50">
          <MilkdownEditor key={`${ticket.id}-${ticket.body ? 'full' : 'stub'}`} defaultValue={displayBody} onChange={(md) => save({ body: md })} />
        </div>

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
