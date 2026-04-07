import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Ticket } from '#/lib/types'
import { Button, Input, Dialog } from './ui'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { TypeSelector } from './TypeSelector'
import { MilkdownEditor } from './MilkdownEditor'
import { useTickets, useDeleteTicket } from '#/lib/hooks/use-tickets'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { TagInput, type Tag as EmblorTag } from 'emblor'

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
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null)
  const [tagObjs, setTagObjs] = useState<EmblorTag[]>(() =>
    ticket.tags.map(t => ({ id: t, text: t })),
  )
  useEffect(() => {
    setTagObjs(ticket.tags.map(t => ({ id: t, text: t })))
  }, [ticket.id, ticket.tags])

  const tagSuggestions = useMemo<EmblorTag[]>(() => {
    const seen = new Set<string>()
    for (const t of allTickets) for (const tag of t.tags) seen.add(tag)
    return Array.from(seen).map(t => ({ id: t, text: t }))
  }, [allTickets])

  const handleSetTags = useCallback((updater: React.SetStateAction<EmblorTag[]>) => {
    setTagObjs(prev => {
      const next = typeof updater === 'function' ? (updater as (p: EmblorTag[]) => EmblorTag[])(prev) : updater
      save({ tags: next.map(t => t.text) })
      return next
    })
  }, [save])

  const handleTagClick = useCallback((tag: EmblorTag) => {
    navigate({ to: '/', search: { tag: tag.text } })
  }, [navigate])

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
        <div className="flex items-start gap-3 mb-4">
          <input
            type="text"
            className="flex-1 min-w-0 bg-transparent text-2xl font-bold rounded-md outline-none placeholder:text-muted-foreground -mx-2 px-2 py-1 cursor-text border border-transparent hover:border-border hover:bg-accent/30 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30 transition-colors"
            defaultValue={ticket.title}
            key={ticket.id}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Ticket title"
            title="Click to edit title"
            aria-label="Ticket title (editable)"
          />
          {ticket.created && (
            <span className="shrink-0 text-xs text-muted-foreground mt-3" title={new Date(ticket.created).toLocaleString()}>
              Created {new Date(ticket.created).toLocaleDateString()}
            </span>
          )}
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
        </div>

        <div className="flex items-start gap-2 mb-4">
          <span className="text-xs text-muted-foreground shrink-0 mt-2">Tags</span>
          <div className="flex-1 min-w-0">
            <TagInput
              tags={tagObjs}
              setTags={handleSetTags}
              activeTagIndex={activeTagIndex}
              setActiveTagIndex={setActiveTagIndex}
              placeholder="Add a tag..."
              enableAutocomplete
              autocompleteOptions={tagSuggestions}
              inlineTags
              addOnPaste
              onTagClick={handleTagClick}
              styleClasses={{
                inlineTagsContainer:
                  'border-0 rounded-md p-1 gap-1 flex-wrap bg-transparent min-h-8',
                input: 'h-6 border-0 shadow-none text-sm bg-transparent focus-visible:ring-0 flex-1 min-w-24',
                tag: {
                  body: 'h-6 px-2 text-xs bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80',
                  closeButton: 'text-muted-foreground hover:text-foreground',
                },
              }}
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
          <MilkdownEditor key={ticket.id} defaultValue={displayBody} onChange={(md) => save({ body: md })} />
        </div>

        <div className="flex justify-end mt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete ticket
          </Button>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete ticket'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
