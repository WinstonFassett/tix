import { useState, useCallback } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('tix-theme') === 'dark'
    if (saved) document.documentElement.classList.add('dark')
    return saved
  })

  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('tix-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  return { dark, toggle }
}
