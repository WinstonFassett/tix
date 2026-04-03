let _statusFilter = $state('')
let _tagFilter = $state('')

export function useFilters() {
  return {
    get statusFilter() { return _statusFilter },
    set statusFilter(v: string) { _statusFilter = v },
    get tagFilter() { return _tagFilter },
    set tagFilter(v: string) { _tagFilter = v },
    clearAll() {
      _statusFilter = ''
      _tagFilter = ''
    },
  }
}
