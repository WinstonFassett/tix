import type { Ticket } from './types'

export const DEFAULT_IGNORED_FOLDERS = ['archive']

export interface FilterOptions {
  search?: string
  status?: string
  tag?: string
  type?: string
  /** Scoped folder path. Undefined = root (show all non-ignored). */
  folderScope?: string
  /** Folders to exclude from the default root view. */
  ignoredFolders?: string[]
}

/** Check if a ticket's folder starts with any of the ignored folder prefixes. */
function isInIgnoredFolder(folder: string, ignored: string[]): boolean {
  if (!folder) return false
  return ignored.some(ig => folder === ig || folder.startsWith(ig + '/'))
}

export function filterTickets(tickets: Ticket[], opts: FilterOptions): Ticket[] {
  let result = tickets
  const ignored = opts.ignoredFolders ?? DEFAULT_IGNORED_FOLDERS

  if (opts.folderScope) {
    // Scoped to a specific folder — show tickets in that folder and its children
    result = result.filter(t =>
      t.folder === opts.folderScope || t.folder.startsWith(opts.folderScope + '/')
    )
  } else {
    // Root view — show everything except ignored folders
    result = result.filter(t => !isInIgnoredFolder(t.folder, ignored))
  }

  if (opts.status) {
    result = result.filter(t => t.status === opts.status)
  }

  if (opts.tag) {
    result = result.filter(t => t.tags.includes(opts.tag!))
  }

  if (opts.type) {
    result = result.filter(t => t.type === opts.type)
  }

  if (opts.search) {
    const q = opts.search.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.assignee.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  return result
}
