import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import type { Ticket } from '@/lib/types'
import { STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_FULL_LABELS, TYPES, TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types'
import type { GroupBy, SortBy, ViewMode } from '@/lib/types'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { StatusIcon } from './icons/StatusIcon'
import { TypeIcon } from './icons/TypeIcon'
import { PriorityIcon } from './icons/PriorityIcon'
import { Badge } from './ui'

export interface PaletteCallbacks {
  toggleTheme: () => void
  toggleSidebar: () => void
  openCreate: () => void
  setViewMode: (mode: ViewMode) => void
  setGroupBy: (groupBy: GroupBy) => void
  setSortBy: (sortBy: SortBy) => void
  toggleSortDir: () => void
  updateTicket?: (updates: Record<string, any>) => void
  copyFilePath?: () => void
  openInVSCode?: () => void
  revealInFinder?: () => void
}

interface CommandPaletteProps {
  tickets: Ticket[]
  callbacks: PaletteCallbacks
  isTicketView: boolean
}

export function CommandPalette({ tickets, callbacks, isTicketView }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setOpen(false); setSearch('') }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4" onClick={close}>
      <div className="w-full max-w-[640px] animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
        <Command className="bg-popover text-popover-foreground border rounded-lg shadow-2xl overflow-hidden max-h-[70vh] flex flex-col" shouldFilter={true}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 text-base bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border font-mono">Esc</kbd>
          </div>
          <Command.List className="overflow-y-auto p-2 max-h-[calc(70vh-60px)]">
            <Command.Empty className="flex items-center justify-center py-12 text-muted-foreground">
              No results found
            </Command.Empty>

            {/* Navigate */}
            <Command.Group heading="Navigate">
              {tickets.map(t => (
                <Command.Item
                  key={`nav-${t.id}`}
                  value={`${t.title} ${t.id} ${t.assignee} ${t.tags.join(' ')} ${t.type} ${t.status}`}
                  onSelect={() => { close(); navigate({ to: '/ticket/$ticketId', params: { ticketId: t.id } }) }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-accent border border-transparent data-[selected=true]:border-border"
                >
                  <StatusIcon status={t.status} size={14} />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{t.title}</span>
                      <span className="ml-auto shrink-0"><TypeIcon type={t.type} size={13} /></span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{t.id}</span>
                      <span>·</span>
                      <span>{STATUS_LABELS[t.status]}</span>
                      <span>·</span>
                      <span>{TYPE_LABELS[t.type] || t.type}</span>
                      <span>·</span>
                      <span>{PRIORITY_LABELS[t.priority] || `P${t.priority}`}</span>
                      {t.tags.length > 0 && (
                        <>
                          <span className="ml-auto" />
                          {t.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 rounded-full leading-tight">{tag}</Badge>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </Command.Item>
              ))}
              {isTicketView && (
                <Command.Item
                  value="go to dashboard home all issues list"
                  onSelect={() => { close(); navigate({ to: '/' }) }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent"
                >
                  <span className="font-medium">Go to Dashboard</span>
                  <span className="text-xs text-muted-foreground ml-auto">All issues view</span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Actions">
              <Command.Item value="create new ticket add issue" onSelect={() => { close(); callbacks.openCreate() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                <span className="font-medium">Create New Ticket</span>
              </Command.Item>
              <Command.Item value="toggle sidebar panel nav" onSelect={() => { close(); callbacks.toggleSidebar() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                <span className="font-medium">Toggle Sidebar</span>
              </Command.Item>
              <Command.Item value="toggle theme dark light mode" onSelect={() => { close(); callbacks.toggleTheme() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                <span className="font-medium">Toggle Theme</span>
              </Command.Item>
            </Command.Group>

            {/* Ticket context */}
            {isTicketView && callbacks.updateTicket && (
              <Command.Group heading="Ticket">
                {STATUSES.map(s => (
                  <Command.Item key={`status-${s}`} value={`set status ${s} ${STATUS_LABELS[s]}`} onSelect={() => { close(); callbacks.updateTicket!({ status: s }) }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Set status: {STATUS_LABELS[s]}</span>
                  </Command.Item>
                ))}
                {PRIORITIES.map(p => (
                  <Command.Item key={`priority-${p}`} value={`set priority p${p} ${PRIORITY_FULL_LABELS[p]}`} onSelect={() => { close(); callbacks.updateTicket!({ priority: p }) }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Set priority: {PRIORITY_FULL_LABELS[p]}</span>
                  </Command.Item>
                ))}
                {TYPES.map(t => (
                  <Command.Item key={`type-${t}`} value={`set type ${t} ${TYPE_LABELS[t]}`} onSelect={() => { close(); callbacks.updateTicket!({ type: t }) }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Set type: {TYPE_LABELS[t]}</span>
                  </Command.Item>
                ))}
                {callbacks.copyFilePath && (
                  <Command.Item value="copy file path clipboard" onSelect={() => { close(); callbacks.copyFilePath!() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Copy File Path</span>
                  </Command.Item>
                )}
                {callbacks.openInVSCode && (
                  <Command.Item value="open vscode editor code" onSelect={() => { close(); callbacks.openInVSCode!() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Open in VS Code</span>
                  </Command.Item>
                )}
                {callbacks.revealInFinder && (
                  <Command.Item value="reveal finder folder explore" onSelect={() => { close(); callbacks.revealInFinder!() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                    <span className="font-medium">Reveal in Finder</span>
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {/* View */}
            {!isTicketView && (
              <Command.Group heading="View">
                <Command.Item value="switch to list view" onSelect={() => { close(); callbacks.setViewMode('list') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Switch to List view</span>
                </Command.Item>
                <Command.Item value="switch to board view" onSelect={() => { close(); callbacks.setViewMode('board') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Switch to Board view</span>
                </Command.Item>
                <Command.Item value="group by status" onSelect={() => { close(); callbacks.setGroupBy('status') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Group by: Status</span>
                </Command.Item>
                <Command.Item value="group by priority" onSelect={() => { close(); callbacks.setGroupBy('priority') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Group by: Priority</span>
                </Command.Item>
                <Command.Item value="group by type" onSelect={() => { close(); callbacks.setGroupBy('type') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Group by: Type</span>
                </Command.Item>
                <Command.Item value="group by none" onSelect={() => { close(); callbacks.setGroupBy('none') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Group by: None</span>
                </Command.Item>
                <Command.Item value="sort by priority" onSelect={() => { close(); callbacks.setSortBy('priority') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Sort by: Priority</span>
                </Command.Item>
                <Command.Item value="sort by title" onSelect={() => { close(); callbacks.setSortBy('title') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Sort by: Title</span>
                </Command.Item>
                <Command.Item value="sort by created" onSelect={() => { close(); callbacks.setSortBy('created') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Sort by: Created</span>
                </Command.Item>
                <Command.Item value="sort by status" onSelect={() => { close(); callbacks.setSortBy('status') }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Sort by: Status</span>
                </Command.Item>
                <Command.Item value="toggle sort direction ascending descending reverse" onSelect={() => { close(); callbacks.toggleSortDir() }} className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent">
                  <span className="font-medium">Toggle Sort Direction</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
