let sidebarOpen = $state(localStorage.getItem('tix-sidebar') !== 'collapsed')

export function useSidebar() {
  return {
    get open() { return sidebarOpen },
    toggle() {
      sidebarOpen = !sidebarOpen
      localStorage.setItem('tix-sidebar', sidebarOpen ? 'open' : 'collapsed')
    }
  }
}
