import { useState } from 'react'
import { Popover } from './ui/Popover'
import { TYPES, TYPE_LABELS } from '@/lib/types'
import { Check } from 'lucide-react'

interface TypeSelectorProps {
  type: string
  onSelect: (type: string) => void
}

export function TypeSelector({ type, onSelect }: TypeSelectorProps) {
  const [open, setOpen] = useState(false)

  function select(id: string) {
    setOpen(false)
    if (id !== type) onSelect(id)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" className="h-7 inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 text-sm hover:bg-accent transition-colors">
          <span>{TYPE_LABELS[type] ?? type}</span>
        </button>
      }
    >
      {TYPES.map(t => (
        <button
          type="button"
          key={t}
          className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors ${t === type ? 'bg-accent/50' : ''}`}
          onClick={() => select(t)}
        >
          <span>{TYPE_LABELS[t]}</span>
          {t === type && <Check className="ml-auto h-4 w-4" />}
        </button>
      ))}
    </Popover>
  )
}
