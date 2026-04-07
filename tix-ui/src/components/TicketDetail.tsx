import { useState, useEffect, useRef, useCallback } from 'react'
import type { Ticket } from '#/lib/types'
import { Button, Input } from './ui'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { TypeSelector } from './TypeSelector'
import { MilkdownEditor } from './MilkdownEditor'
import { useConfig } from '#/lib/hooks/use-tickets'
import { useSidebar } from '#/lib/AppContext'
import { useNavigate } from '@tanstack/react-router'
import { PanelLeft, ChevronLeft, Copy, ExternalLink, Folder, ChevronRight } from 'lucide-react'

interface PagerState {
  index: number
  total: number
  onPrev?: () => void
  onNext?: () => void
}

interface TicketDetailProps {
  ticket: Ticket
  onUpdate: (updates: Record<string, any>) => Promise<void> | void
  pager?: PagerState
}

function stripLeadingTitle(body: string): string {
  return body.replace(/^\s*#\s+[^\n]*\n*/, '')
}

export function TicketDetail({ ticket, onUpdate, pager }: TicketDetailProps) {
  const navigate = useNavigate()
  const { toggle: toggleSidebar } = useSidebar()
  const { data: config } = useConfig()
  const ticketsDir = config?.ticketsDir || ''
  const filePath = ticketsDir && ticket.filename ? `${ticketsDir}/${ticket.filename}` : ''

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

  // Keyboard shortcuts for the ticket pager: J / K (vim-ish) and
  // Alt+ArrowLeft / Alt+ArrowRight. Plain arrow keys are left alone so
  // the user can still navigate text inputs and the editor.
  useEffect(() => {
    if (!pager) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      if (inEditable) return
      if (e.key === 'j' || e.key === 'J' || (e.altKey && e.key === 'ArrowRight')) {
        if (pager.onNext) { e.preventDefault(); pager.onNext() }
      } else if (e.key === 'k' || e.key === 'K' || (e.altKey && e.key === 'ArrowLeft')) {
        if (pager.onPrev) { e.preventDefault(); pager.onPrev() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pager])

  function copyTicketId() {
    if (navigator.clipboard) navigator.clipboard.writeText(ticket.id)
  }

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

  function handleTagsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean)
    save({ tags })
  }

  function copyPath() {
    if (filePath) navigator.clipboard.writeText(filePath)
  }

  return (
    <>
      {/* Detail header */}
      <div className="w-full flex items-center border-b py-1.5 px-6 h-10">
        <button
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
          onClick={toggleSidebar}
          title="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => navigate({ to: '/' })}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-1 ml-3">
          {pager && pager.total > 1 ? (
            <div className="inline-flex items-center rounded-md border h-7">
              <button
                className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent rounded-l-md"
                onClick={pager.onPrev}
                disabled={!pager.onPrev}
                title="Previous ticket (K or Alt+←)"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                className="h-7 px-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-accent border-x"
                onClick={copyTicketId}
                title="Click to copy ticket ID"
              >
                {ticket.id}
              </button>
              <button
                className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent rounded-r-md"
                onClick={pager.onNext}
                disabled={!pager.onNext}
                title="Next ticket (J or Alt+→)"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground px-1"
              onClick={copyTicketId}
              title="Click to copy ticket ID"
            >
              {ticket.id}
            </button>
          )}
          {pager && pager.total > 1 && pager.index >= 0 && (
            <span className="text-xs text-muted-foreground ml-1">{pager.index + 1} of {pager.total}</span>
          )}
          {saveState === 'saving' && <span className="text-xs text-muted-foreground ml-2">Saving...</span>}
          {saveState === 'saved' && <span className="text-xs text-muted-foreground ml-2">Saved</span>}
          {saveState === 'error' && <span className="text-xs text-destructive ml-2">Save failed</span>}
        </div>
        {filePath && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground font-mono truncate max-w-80" title={filePath}>{ticket.filename}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyPath} title="Copy file path">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => window.open(`vscode://file/${filePath}`)} title="Open in VS Code">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => window.open(`vscode://file/${ticketsDir}`)} title="Reveal in Finder">
              <Folder className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto py-6 px-6">
          <input
            type="text"
            className="w-full bg-transparent text-2xl font-bold border-none outline-none placeholder:text-muted-foreground mb-4"
            defaultValue={ticket.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Ticket title"
          />

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusSelector status={ticket.status} onSelect={(s) => handleFieldChange('status', s)} />
            <PrioritySelector priority={ticket.priority} onSelect={(p) => handleFieldChange('priority', p)} />
            <TypeSelector type={ticket.type} onSelect={(t) => handleFieldChange('type', t)} />
            <Input
              type="text"
              className="w-40 h-8 text-sm"
              defaultValue={ticket.assignee}
              onChange={(e) => handleFieldChange('assignee', e.target.value)}
              placeholder="Assignee"
            />
            {ticket.created && (
              <span className="ml-auto text-xs text-muted-foreground" title={new Date(ticket.created).toLocaleString()}>
                Created {new Date(ticket.created).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground shrink-0">Tags</span>
            <Input
              type="text"
              className="flex-1 h-8 text-sm"
              defaultValue={ticket.tags.join(', ')}
              onChange={handleTagsChange}
              placeholder="tag1, tag2, ..."
            />
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
            <MilkdownEditor defaultValue={displayBody} onChange={(md) => save({ body: md })} />
          </div>
        </div>
      </div>
    </>
  )
}
