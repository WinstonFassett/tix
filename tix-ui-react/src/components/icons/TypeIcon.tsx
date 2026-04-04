import { TYPE_COLORS } from '@/lib/types'

interface TypeIconProps {
  type: string
  size?: number
}

export function TypeIcon({ type, size = 14 }: TypeIconProps) {
  const color = TYPE_COLORS[type] || TYPE_COLORS['task']

  if (type === 'bug') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Bug">
        <circle cx="8" cy="9" r="4" />
        <path d="M8 5V3" />
        <path d="M6.5 3.5L9.5 3.5" />
        <path d="M4 7L2 6" />
        <path d="M12 7L14 6" />
        <path d="M4 11L2 12" />
        <path d="M12 11L14 12" />
      </svg>
    )
  }
  if (type === 'feature') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Feature">
        <polygon points="8,2 10,6.5 15,7 11.5,10.5 12.5,15 8,12.5 3.5,15 4.5,10.5 1,7 6,6.5" />
      </svg>
    )
  }
  if (type === 'epic') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Epic">
        <path d="M9 2L4 9H8L7 14L12 7H8L9 2Z" />
      </svg>
    )
  }
  // task (default)
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Task">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8L7 10L11 6" />
    </svg>
  )
}
