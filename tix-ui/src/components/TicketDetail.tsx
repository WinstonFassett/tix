import { useEffect, useState } from 'react'
import type { Ticket } from '#/lib/types'
import { Button } from './ui'
import { TicketDetailBody } from './TicketDetailBody'
import { useSidebar } from '#/lib/AppContext'
import { useNavigate } from '@tanstack/react-router'
import { PanelLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { TicketActions } from './TicketActions'

interface PagerState {
  index: number
  total: number
  onPrev?: () => void
  onNext?: () => void
}

interface TicketDetailProps {
  ticket: Ticket
  onUpdate: (updates: Partial<Ticket>) => Promise<void> | void
  pager?: PagerState
}

export function TicketDetail({ ticket, onUpdate, pager }: TicketDetailProps) {
  const navigate = useNavigate()
  const { toggle: toggleSidebar } = useSidebar()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
        <div className="ml-auto">
          <TicketActions ticket={ticket} />
        </div>
      </div>

      {/* Detail content */}
      <div className="flex-1 overflow-auto">
        <TicketDetailBody ticket={ticket} onUpdate={onUpdate} onSaveStateChange={setSaveState} />
      </div>
    </>
  )
}
