import { useState, useEffect, useRef, useCallback } from 'react'
import type { Ticket } from '@/lib/types'
import { TYPES } from '@/lib/types'
import { Button, Input, Select } from './ui'
import { StatusSelector } from './StatusSelector'
import { PrioritySelector } from './PrioritySelector'
import { MilkdownEditor } from './MilkdownEditor'
import { useConfig } from '@/lib/hooks/use-tickets'
import { useSidebar } from '@/lib/AppContext'
import { useNavigate } from '@tanstack/react-router'
import { PanelLeft, ChevronLeft, Copy, ExternalLink, Folder } from 'lucide-react'

interface TicketDetailProps {
  ticket: Ticket
  onUpdate: (updates: Record<string, any>) => Promise<void> | void
}

function stripLeadingTitle(body: string): string {
  return body.replace(/^\s*#\s+[^\n]*\n*/, '')
}

export function TicketDetail({ ticket, onUpdate }: TicketDetailProps) {
  const navigate = useNavigate()
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar()
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
    }, 500)
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
        <div className="flex items-center gap-2 ml-3">
          <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
          {saveState === 'saving' && <span className="text-xs text-muted-foreground">Saving...</span>}
          {saveState === 'saved' && <span className="text-xs text-muted-foreground">Saved</span>}
          {saveState === 'error' && <span className="text-xs text-destructive">Save failed</span>}
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

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <StatusSelector status={ticket.status} onSelect={(s) => handleFieldChange('status', s)} />
            <PrioritySelector priority={ticket.priority} onSelect={(p) => handleFieldChange('priority', p)} />

            <Select
              className="w-auto h-8 text-sm"
              defaultValue={ticket.type}
              onChange={(e) => handleFieldChange('type', e.target.value)}
            >
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>

            <Input
              type="text"
              className="w-40 h-8 text-sm"
              defaultValue={ticket.assignee}
              onChange={(e) => handleFieldChange('assignee', e.target.value)}
              placeholder="Assignee"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs text-muted-foreground">
            {ticket.created && (
              <span>Created {new Date(ticket.created).toLocaleDateString()}</span>
            )}
            <span>Tags:</span>
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
