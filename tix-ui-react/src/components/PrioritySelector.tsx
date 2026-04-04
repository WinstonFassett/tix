import { useState } from 'react'
import { PriorityIcon } from './icons/PriorityIcon'
import { Popover } from './ui/Popover'
import { PRIORITIES, PRIORITY_LABELS } from '@/lib/types'
import { Check } from 'lucide-react'

interface PrioritySelectorProps {
  priority: number
  onSelect: (priority: number) => void
  compact?: boolean
}

export function PrioritySelector({ priority, onSelect, compact = false }: PrioritySelectorProps) {
  const [open, setOpen] = useState(false)

  function select(value: number) {
    setOpen(false)
    if (value !== priority) onSelect(value)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          className={`h-7 inline-flex items-center gap-1.5 rounded-md ${compact ? 'px-1.5 hover:bg-accent' : 'bg-secondary px-2 hover:bg-accent'} text-sm transition-colors`}
          title={PRIORITY_LABELS[priority] ?? `P${priority}`}
        >
          <PriorityIcon priority={priority} size={compact ? 14 : 12} />
          {!compact && <span>{PRIORITY_LABELS[priority] ?? `P${priority}`}</span>}
        </button>
      }
    >
      {PRIORITIES.map(p => (
        <button
          key={p}
          className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors ${p === priority ? 'bg-accent/50' : ''}`}
          onClick={() => select(p)}
        >
          <PriorityIcon priority={p} size={14} />
          <span>{PRIORITY_LABELS[p]}</span>
          {p === priority && <Check className="ml-auto h-4 w-4" />}
        </button>
      ))}
    </Popover>
  )
}
