export interface Ticket {
  id: string
  title: string
  status: 'open' | 'in-progress' | 'on-hold' | 'done' | 'closed'
  deps: string[]
  links: string[]
  created: string
  type: string
  priority: number
  assignee: string
  tags: string[]
  body: string
  filename: string
}

export type TicketStatus = Ticket['status']
export const STATUSES: TicketStatus[] = ['open', 'in-progress', 'on-hold', 'done', 'closed']
export const STATUS_LABELS: Record<TicketStatus, string> = {
  'open': 'Open',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  'done': 'Done',
  'closed': 'Closed',
}
export const STATUS_COLORS: Record<TicketStatus, string> = {
  'open': '#f97316',
  'in-progress': '#facc15',
  'on-hold': '#94a3b8',
  'done': '#8b5cf6',
  'closed': '#94a3b8',
}

export const PRIORITIES = [0, 1, 2, 3, 4] as const
export const PRIORITY_LABELS: Record<number, string> = {
  0: 'Urgent', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'No priority',
}
export const PRIORITY_FULL_LABELS: Record<number, string> = {
  0: 'P0 — Critical', 1: 'P1 — High', 2: 'P2 — Medium', 3: 'P3 — Low', 4: 'P4 — None',
}

export const TYPES = ['task', 'bug', 'feature', 'epic'] as const
export const TYPE_LABELS: Record<string, string> = {
  task: 'Task', bug: 'Bug', feature: 'Feature', epic: 'Epic',
}
export const TYPE_COLORS: Record<string, string> = {
  task: '#94a3b8', bug: '#ef4444', feature: '#3b82f6', epic: '#d946ef',
}

export type GroupBy = 'status' | 'priority' | 'type' | 'none'
export type SortBy = 'priority' | 'title' | 'created' | 'status'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'list' | 'board'
