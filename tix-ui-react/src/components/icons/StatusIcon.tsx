interface StatusIconProps {
  status: string
  size?: number
}

const config: Record<string, { color: string; progress: number; dashed?: boolean; check?: boolean; pause?: boolean }> = {
  'open':        { color: '#f97316', progress: 0, dashed: false },
  'in-progress': { color: '#facc15', progress: 0.33 },
  'on-hold':     { color: '#94a3b8', progress: 0, pause: true },
  'done':        { color: '#8b5cf6', progress: 1, check: true },
  'closed':      { color: '#94a3b8', progress: 0, dashed: true },
}

export function StatusIcon({ status, size = 14 }: StatusIconProps) {
  const c = config[status] ?? config['open']!
  const r = 2
  const circumference = 2 * Math.PI * r
  const dashArray = `${circumference * c.progress} 100`

  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle
        cx="7" cy="7" r="6"
        fill="none"
        stroke={c.color}
        strokeWidth="2"
        strokeDasharray={c.dashed ? '1.4 1.74' : '3.14 0'}
        strokeDashoffset={c.dashed ? '0.65' : '-0.7'}
      />
      {c.check ? (
        <path
          d="M4.5 7L6.5 9L9.5 5"
          stroke={c.color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : c.pause ? (
        <>
          <rect x="5" y="4.5" width="1.5" height="5" rx="0.5" fill={c.color} />
          <rect x="7.5" y="4.5" width="1.5" height="5" rx="0.5" fill={c.color} />
        </>
      ) : (
        <circle
          cx="7" cy="7" r={r}
          fill="none"
          stroke={c.color}
          strokeWidth="4"
          strokeDasharray={dashArray}
          strokeDashoffset="0"
          transform="rotate(-90 7 7)"
        />
      )}
    </svg>
  )
}
