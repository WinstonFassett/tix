interface PriorityIconProps {
  priority: number
  size?: number
}

export function PriorityIcon({ priority, size = 16 }: PriorityIconProps) {
  if (priority === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-label="Urgent">
        <path d="M3 1C1.91067 1 1 1.91067 1 3V13C1 14.0893 1.91067 15 3 15H13C14.0893 15 15 14.0893 15 13V3C15 1.91067 14.0893 1 13 1H3ZM7 4L9 4L8.75391 8.99836H7.25L7 4ZM9 11C9 11.5523 8.55228 12 8 12C7.44772 12 7 11.5523 7 11C7 10.4477 7.44772 10 8 10C8.55228 10 9 10.4477 9 11Z"/>
      </svg>
    )
  }
  if (priority === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-label="High">
        <rect x="1.5" y="8" width="3" height="6" rx="1"/>
        <rect x="6.5" y="5" width="3" height="9" rx="1"/>
        <rect x="11.5" y="2" width="3" height="12" rx="1"/>
      </svg>
    )
  }
  if (priority === 2) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-label="Medium">
        <rect x="1.5" y="8" width="3" height="6" rx="1"/>
        <rect x="6.5" y="5" width="3" height="9" rx="1"/>
        <rect x="11.5" y="2" width="3" height="12" rx="1" fillOpacity="0.4"/>
      </svg>
    )
  }
  if (priority === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-label="Low">
        <rect x="1.5" y="8" width="3" height="6" rx="1"/>
        <rect x="6.5" y="5" width="3" height="9" rx="1" fillOpacity="0.4"/>
        <rect x="11.5" y="2" width="3" height="12" rx="1" fillOpacity="0.4"/>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-label="No Priority" opacity="0.5">
      <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.5"/>
      <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.5"/>
      <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.5"/>
    </svg>
  )
}
