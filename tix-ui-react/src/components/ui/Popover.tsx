import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}

export function Popover({ open: controlledOpen, onOpenChange, trigger, children, align = 'start', className }: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, setOpen])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className={cn(
          'absolute z-50 mt-1 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          align === 'end' ? 'right-0' : 'left-0',
          className,
        )}>
          {children}
        </div>
      )}
    </div>
  )
}
