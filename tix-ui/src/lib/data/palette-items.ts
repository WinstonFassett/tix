import { defineActions } from 'svelte-command-palette'
import type { action } from 'svelte-command-palette'
import type { Ticket } from '../types'
import type { Route } from './router'
import type { GroupBy, SortBy, ViewMode } from './view-settings.svelte'

export interface PaletteCallbacks {
  toggleTheme: () => void
  toggleSidebar: () => void
  openCreate: () => void
  setViewMode: (mode: ViewMode) => void
  setGroupBy: (groupBy: GroupBy) => void
  setSortBy: (sortBy: SortBy) => void
  toggleSortDir: () => void
  updateTicket?: (updates: Record<string, any>) => void
  copyFilePath?: () => void
  openInVSCode?: () => void
  revealInFinder?: () => void
}

// ── Navigate ──────────────────────────────────────────────────

function navItems(tickets: Ticket[], route: Route): action[] {
  const items: action[] = []

  for (const t of tickets) {
    items.push({
      actionId: `nav-ticket-${t.id}`,
      title: t.title,
      description: `${t.id} · ${t.status} · ${t.type}`,
      group: 'Navigate',
      keywords: [t.id, t.title, t.assignee, ...t.tags, t.type, t.status],
      onRun: () => { location.hash = `#/ticket/${t.id}` },
    })
  }

  if (route.view !== 'dashboard') {
    items.push({
      actionId: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'All issues view',
      group: 'Navigate',
      keywords: ['home', 'all', 'issues', 'list', 'dashboard'],
      onRun: () => { location.hash = '#/' },
    })
  }

  return items
}

// ── Actions ───────────────────────────────────────────────────

function actionItems(callbacks: PaletteCallbacks): action[] {
  return [
    {
      actionId: 'action-create',
      title: 'Create New Ticket',
      description: 'Open the create ticket dialog',
      group: 'Actions',
      keywords: ['new', 'add', 'issue', 'create', 'ticket'],
      onRun: () => callbacks.openCreate(),
    },
    {
      actionId: 'action-sidebar',
      title: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      group: 'Actions',
      keywords: ['sidebar', 'panel', 'nav', 'toggle'],
      onRun: () => callbacks.toggleSidebar(),
    },
    {
      actionId: 'action-theme',
      title: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      group: 'Actions',
      keywords: ['dark', 'light', 'mode', 'theme', 'toggle'],
      onRun: () => callbacks.toggleTheme(),
    },
  ]
}

// ── Ticket context ────────────────────────────────────────────

const statuses = ['open', 'in-progress', 'on-hold', 'done', 'closed'] as const
const statusLabels: Record<string, string> = {
  'open': 'Open', 'in-progress': 'In Progress', 'on-hold': 'On Hold',
  'done': 'Done', 'closed': 'Closed',
}

const priorities = [0, 1, 2, 3, 4] as const
const priorityLabels: Record<number, string> = {
  0: 'P0 — Critical', 1: 'P1 — High', 2: 'P2 — Medium',
  3: 'P3 — Low', 4: 'P4 — None',
}

const types = ['task', 'bug', 'feature', 'epic'] as const
const typeLabels: Record<string, string> = {
  task: 'Task', bug: 'Bug', feature: 'Feature', epic: 'Epic',
}

function ticketItems(callbacks: PaletteCallbacks): action[] {
  if (!callbacks.updateTicket) return []

  const items: action[] = []

  for (const s of statuses) {
    items.push({
      actionId: `set-status-${s}`,
      title: `Set status: ${statusLabels[s]}`,
      group: 'Ticket',
      keywords: ['status', s, statusLabels[s]],
      onRun: () => callbacks.updateTicket!({ status: s }),
    })
  }

  for (const p of priorities) {
    items.push({
      actionId: `set-priority-${p}`,
      title: `Set priority: ${priorityLabels[p]}`,
      group: 'Ticket',
      keywords: ['priority', `p${p}`, priorityLabels[p]],
      onRun: () => callbacks.updateTicket!({ priority: p }),
    })
  }

  for (const t of types) {
    items.push({
      actionId: `set-type-${t}`,
      title: `Set type: ${typeLabels[t]}`,
      group: 'Ticket',
      keywords: ['type', t, typeLabels[t]],
      onRun: () => callbacks.updateTicket!({ type: t }),
    })
  }

  if (callbacks.copyFilePath) {
    items.push({
      actionId: 'ticket-copy-path',
      title: 'Copy File Path',
      group: 'Ticket',
      keywords: ['copy', 'path', 'file', 'clipboard'],
      onRun: () => callbacks.copyFilePath!(),
    })
  }

  if (callbacks.openInVSCode) {
    items.push({
      actionId: 'ticket-vscode',
      title: 'Open in VS Code',
      group: 'Ticket',
      keywords: ['vscode', 'editor', 'open', 'code'],
      onRun: () => callbacks.openInVSCode!(),
    })
  }

  if (callbacks.revealInFinder) {
    items.push({
      actionId: 'ticket-finder',
      title: 'Reveal in Finder',
      group: 'Ticket',
      keywords: ['finder', 'folder', 'reveal', 'explore'],
      onRun: () => callbacks.revealInFinder!(),
    })
  }

  return items
}

// ── Dashboard view commands ───────────────────────────────────

const groupByLabels: Record<GroupBy, string> = {
  status: 'Status', priority: 'Priority', type: 'Type', none: 'None',
}
const sortByLabels: Record<SortBy, string> = {
  priority: 'Priority', title: 'Title', created: 'Created', status: 'Status',
}
const viewModeLabels: Record<ViewMode, string> = {
  list: 'List', board: 'Board',
}

function viewItems(callbacks: PaletteCallbacks): action[] {
  const items: action[] = []

  for (const [mode, label] of Object.entries(viewModeLabels)) {
    items.push({
      actionId: `set-view-${mode}`,
      title: `Switch to ${label} view`,
      group: 'View',
      keywords: ['view', mode, label],
      onRun: () => callbacks.setViewMode(mode as ViewMode),
    })
  }

  for (const [g, label] of Object.entries(groupByLabels)) {
    items.push({
      actionId: `set-group-${g}`,
      title: `Group by: ${label}`,
      group: 'View',
      keywords: ['group', g, label],
      onRun: () => callbacks.setGroupBy(g as GroupBy),
    })
  }

  for (const [s, label] of Object.entries(sortByLabels)) {
    items.push({
      actionId: `set-sort-${s}`,
      title: `Sort by: ${label}`,
      group: 'View',
      keywords: ['sort', s, label],
      onRun: () => callbacks.setSortBy(s as SortBy),
    })
  }

  items.push({
    actionId: 'view-sort-dir',
    title: 'Toggle Sort Direction',
    description: 'Switch between ascending and descending',
    group: 'View',
    keywords: ['ascending', 'descending', 'reverse', 'direction', 'sort'],
    onRun: () => callbacks.toggleSortDir(),
  })

  return items
}

// ── Public API ────────────────────────────────────────────────

export function buildPaletteItems(
  tickets: Ticket[],
  route: Route,
  callbacks: PaletteCallbacks,
): action[] {
  return defineActions([
    ...navItems(tickets, route),
    ...actionItems(callbacks),
    ...(route.view === 'ticket' ? ticketItems(callbacks) : []),
    ...(route.view === 'dashboard' ? viewItems(callbacks) : []),
  ])
}
