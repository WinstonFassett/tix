import { useState, useCallback } from 'react'

export function useSidebar() {
  const [open, setOpen] = useState(() => localStorage.getItem('tix-sidebar') !== 'collapsed')

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem('tix-sidebar', next ? 'open' : 'collapsed')
      return next
    })
  }, [])

  return { open, toggle }
}
