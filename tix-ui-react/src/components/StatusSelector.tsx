import { useState } from 'react'
import { StatusIcon } from './icons/StatusIcon'
import { Popover } from './ui/Popover'
import { STATUSES, STATUS_LABELS, type TicketStatus } from '@/lib/types'
import { Check } from 'lucide-react'

interface StatusSelectorProps {
  status: string
  onSelect: (status: string) => void
  compact?: boolean
}

export function StatusSelector({ status, onSelect, compact = false }: StatusSelectorProps) {
  const [open, setOpen] = useState(false)

  function select(id: string) {
    setOpen(false)
    if (id !== status) onSelect(id)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          className={`h-7 inline-flex items-center gap-1.5 rounded-md ${compact ? 'px-1.5 hover:bg-accent' : 'bg-secondary px-2 hover:bg-accent'} text-sm transition-colors`}
          title={STATUS_LABELS[status as TicketStatus] ?? status}
        >
          <StatusIcon status={status} size={compact ? 14 : 12} />
          {!compact && <span>{STATUS_LABELS[status as TicketStatus] ?? status}</span>}
        </button>
      }
    >
      {STATUSES.map(s => (
        <button
          key={s}
          className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors ${s === status ? 'bg-accent/50' : ''}`}
          onClick={() => select(s)}
        >
          <StatusIcon status={s} size={12} />
          <span>{STATUS_LABELS[s]}</span>
          {s === status && <Check className="ml-auto h-4 w-4" />}
        </button>
      ))}
    </Popover>
  )
}
