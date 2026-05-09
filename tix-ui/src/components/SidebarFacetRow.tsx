import { useDroppable } from '@dnd-kit/core'
import { useChangeHighlight } from '#/components/AnimatedCount'
import { useDndState } from '#/lib/DndProvider'

export function SidebarFacetRow({ count, active, onClick, icon, label, truncateLabel, droppableId, dimension, value }: {
  count: number
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  truncateLabel?: boolean
  droppableId?: string
  dimension?: string
  value?: string
}) {
  const gen = useChangeHighlight(count)
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `_noop_${label}`, disabled: !droppableId })
  const { overTarget } = useDndState()
  const crossHighlight = !isOver && overTarget && dimension && value && overTarget.dimension === dimension && overTarget.value === value

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors ${
        isOver || crossHighlight ? 'bg-primary/15 ring-1 ring-primary/40' :
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
      onClick={onClick}
    >
      {gen > 0 && (
        <div
          key={gen}
          className="absolute inset-0 anim-row-highlight pointer-events-none rounded-md"
        />
      )}
      {icon}
      <span className={truncateLabel ? 'truncate' : ''}>{label}</span>
      <span className="ml-auto text-xs">{count}</span>
    </div>
  )
}
