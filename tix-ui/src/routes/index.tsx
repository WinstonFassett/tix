import { useEffect } from 'react'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useFilters } from '#/lib/AppContext'
import { DashboardView } from '#/components/DashboardView'

interface DashboardSearch {
  status?: string
  tag?: string
  type?: string
  folder?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    status: typeof search.status === 'string' ? search.status : undefined,
    tag: typeof search.tag === 'string' ? search.tag : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
    folder: typeof search.folder === 'string' ? search.folder : undefined,
  }),
  component: DashboardViewWrapper,
})

function DashboardViewWrapper() {
  const search = useSearch({ from: '/' })
  const filters = useFilters()

  // Sync URL search params -> filter state
  useEffect(() => {
    filters.setStatusFilter(search.status || '')
    filters.setTagFilter(search.tag || '')
    filters.setTypeFilter(search.type || '')
    filters.setFolderScope(search.folder || '')
  }, [search.status, search.tag, search.type, search.folder]) // eslint-disable-line react-hooks/exhaustive-deps

  return <DashboardView />
}
