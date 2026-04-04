import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import type { Ticket } from '@/lib/types'
import { STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_FULL_LABELS, TYPES, TYPE_LABELS } from '@/lib/types'
import type { GroupBy, SortBy, ViewMode } from '@/lib/types'
import { useNavigate, useLocation } from '@tanstack/react-router'

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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => { setOpen(false); setSearch('') }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4" onClick={close}>
      <div className="w-full max-w-[640px] animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
        <Command className="bg-popover text-popover-foreground border rounded-lg shadow-2xl overflow-hidden max-h-[70vh] flex flex-col" shouldFilter={true}>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 text-base border-b border-border bg-transparent outline-none placeholder:text-muted-foreground"
          />
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent"
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{t.id} · {t.status} · {t.type}</span>
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
