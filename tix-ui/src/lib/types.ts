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
