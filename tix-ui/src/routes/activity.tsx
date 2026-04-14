import { createFileRoute } from '@tanstack/react-router'
import { ActivityView } from '#/components/ActivityView'

export const Route = createFileRoute('/activity')({
  component: ActivityView,
})
