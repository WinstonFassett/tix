let _statusFilter = $state('')
let _tagFilter = $state('')
let _typeFilter = $state('')

export function useFilters() {
  return {
    get statusFilter() { return _statusFilter },
    set statusFilter(v: string) { _statusFilter = v },
    get tagFilter() { return _tagFilter },
    set tagFilter(v: string) { _tagFilter = v },
    get typeFilter() { return _typeFilter },
    set typeFilter(v: string) { _typeFilter = v },
    clearAll() {
      _statusFilter = ''
      _tagFilter = ''
      _typeFilter = ''
    },
  }
}
