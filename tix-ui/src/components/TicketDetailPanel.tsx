import { useEffect, useRef, useState, useCallback } from 'react'
import type { Ticket } from '#/lib/types'
import { Button } from './ui'
import { TicketDetailBody } from './TicketDetailBody'
import { useUpdateTicket, useTicket } from '#/lib/hooks/use-tickets'
import { useDetailPanel } from '#/lib/AppContext'
import { useNavigate } from '@tanstack/react-router'
import { X, Maximize2, Loader2 } from 'lucide-react'

interface TicketDetailPanelProps {
  ticket: Ticket
}

export function TicketDetailPanel({ ticket: listTicket }: TicketDetailPanelProps) {
  const navigate = useNavigate()
  const updateMutation = useUpdateTicket()
  // Fetch full ticket with body (list data has empty body for perf)
  const { data: fullTicket } = useTicket(listTicket.id)
  const ticket = fullTicket ?? listTicket
  const { setSelectedId, width, setWidth } = useDetailPanel()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleUpdate = useCallback(
    async (updates: Record<string, any>) => {
      await updateMutation.mutateAsync({ ticketId: ticket.id, updates })
    },
    [ticket.id, updateMutation],
  )

  function close() {
    setSelectedId(null)
  }

  function openFull() {
    navigate({ to: '/ticket/$ticketId', params: { ticketId: ticket.id } })
  }

  // Two-phase Escape: first press blurs the active editable, second closes panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      if (inEditable) {
        target!.blur()
        return
      }
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-to-resize handle. The handle sits on the LEFT edge of the panel
  // and increases the panel width as the cursor moves left (toward the
  // list). We bind move/up listeners on window so a fast drag doesn't
  // lose tracking when the cursor leaves the handle element.
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function onMove(ev: MouseEvent) {
      if (!draggingRef.current) return
      const delta = startXRef.current - ev.clientX
      setWidth(startWidthRef.current + delta)
    }
    function onUp() {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <aside
      className="relative flex flex-col border-l bg-background h-full shrink-0 anim-overlay-in"
      style={{ width: `${width}px` }}
    >
      {/* Drag handle on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize detail panel"
        onMouseDown={startDrag}
        className="absolute left-0 top-0 h-full w-1 -ml-0.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
      />

      {/* Panel header */}
      <div className="flex items-center gap-1 border-b py-1.5 px-3 h-10 shrink-0">
        <button
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
          onClick={close}
          title="Close panel (Esc)"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
        <div className="ml-2 text-xs text-muted-foreground">
          {saveState === 'saving' && (<><Loader2 className="inline h-3 w-3 animate-spin" /> Saving...</>)}
          {saveState === 'saved' && <span>Saved</span>}
          {saveState === 'error' && <span className="text-destructive">Save failed</span>}
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={openFull} title="Open full view">
            <Maximize2 className="h-3.5 w-3.5" />
            Open
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <TicketDetailBody
          key={ticket.id}
          ticket={ticket}
          onUpdate={handleUpdate}
          fillContainer
          onSaveStateChange={setSaveState}
        />
      </div>
    </aside>
  )
}
