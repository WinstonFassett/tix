import { useState, useCallback } from 'react'

export function useFilters() {
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const clearAll = useCallback(() => {
    setStatusFilter('')
    setTagFilter('')
  }, [])

  return {
    statusFilter,
    setStatusFilter,
    tagFilter,
    setTagFilter,
    clearAll,
  }
}
