/**
 * Ticket mention plugin for Milkdown.
 *
 * Type `#` in a paragraph to open a floating ticket picker.
 * Select a ticket to insert a `[Title](tix:<id>)` link.
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

interface TicketInfo {
  id: string
  title: string
  status: string
  type: string
  priority: number
}

const mentionKey = new PluginKey('ticket-mention')

// Status dot SVG (matches StatusIcon.tsx config)
const STATUS_CFG: Record<string, { color: string }> = {
  'open':        { color: '#f97316' },
  'in-progress': { color: '#facc15' },
  'review':      { color: '#22d3ee' },
  'on-hold':     { color: '#94a3b8' },
  'done':        { color: '#8b5cf6' },
  'closed':      { color: '#94a3b8' },
}

function statusDot(status: string): string {
  const c = STATUS_CFG[status]?.color ?? '#94a3b8'
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>`
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Task', bug: 'Bug', feature: 'Feature', epic: 'Epic',
}
const PRIORITY_LABELS: Record<number, string> = {
  0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4',
}

export function createTicketMentionPlugin(getTickets: () => TicketInfo[]) {
  return $prose(() => {
    return new Plugin({
      key: mentionKey,
      view(editorView) {
        let active = false
        let triggerPos = -1 // position of the '#' character
        let selectedIndex = 0
        let filtered: TicketInfo[] = []

        // Build DOM
        const dropdown = document.createElement('div')
        dropdown.className = 'tix-mention-dropdown'
        dropdown.style.cssText = `
          display:none;position:fixed;z-index:9999;
          background:var(--popover,#fff);color:var(--popover-foreground,#111);
          border:1px solid var(--border,#e5e5e5);border-radius:8px;
          box-shadow:0 4px 16px rgba(0,0,0,0.18);
          max-height:260px;overflow-y:auto;width:340px;
          padding:4px;
        `
        document.body.appendChild(dropdown)

        function hide() {
          active = false
          triggerPos = -1
          dropdown.style.display = 'none'
          dropdown.innerHTML = ''
        }

        function show() {
          active = true
          dropdown.style.display = 'block'
        }

        function positionDropdown() {
          const coords = editorView.coordsAtPos(triggerPos)
          let top = coords.bottom + 4
          let left = coords.left
          dropdown.style.display = 'block'
          const rect = dropdown.getBoundingClientRect()
          if (top + rect.height > window.innerHeight) top = coords.top - rect.height - 4
          if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8
          dropdown.style.top = `${top}px`
          dropdown.style.left = `${left}px`
        }

        function renderItems() {
          dropdown.innerHTML = ''
          if (filtered.length === 0) {
            const empty = document.createElement('div')
            empty.style.cssText = 'padding:12px 16px;color:var(--muted-foreground,#888);font-size:13px;text-align:center;'
            empty.textContent = 'No tickets found'
            dropdown.appendChild(empty)
            return
          }
          filtered.forEach((t, i) => {
            const item = document.createElement('div')
            item.className = 'tix-mention-item'
            item.dataset.index = String(i)
            item.style.cssText = `
              display:flex;align-items:center;gap:8px;
              padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;
              ${i === selectedIndex ? 'background:var(--accent,#f5f5f5);' : ''}
            `
            item.innerHTML = `
              ${statusDot(t.status)}
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${escapeHtml(t.title)}</span>
              <span style="font-family:monospace;font-size:11px;color:var(--muted-foreground,#888);flex-shrink:0;">${t.id}</span>
              <span style="font-size:11px;color:var(--muted-foreground,#888);flex-shrink:0;">${TYPE_LABELS[t.type] || t.type}</span>
              <span style="font-size:11px;color:var(--muted-foreground,#888);flex-shrink:0;">${PRIORITY_LABELS[t.priority] ?? ''}</span>
            `
            item.addEventListener('mouseenter', () => {
              selectedIndex = i
              // Update highlight styles without rebuilding DOM
              Array.from(dropdown.children).forEach((child, ci) => {
                ;(child as HTMLElement).style.background = ci === selectedIndex
                  ? 'var(--accent,#f5f5f5)' : ''
              })
            })
            item.addEventListener('mousedown', (e) => {
              e.preventDefault()
              e.stopPropagation()
              selectItem(i)
            })
            dropdown.appendChild(item)
          })
          // Scroll selected into view
          const sel = dropdown.children[selectedIndex] as HTMLElement | undefined
          sel?.scrollIntoView({ block: 'nearest' })
        }

        function selectItem(index: number) {
          const t = filtered[index]
          if (!t) return
          const { state, dispatch } = editorView
          const linkMark = state.schema.marks.link
          if (!linkMark) { hide(); return }
          const cursorPos = state.selection.from
          const mark = linkMark.create({ href: `tix:${t.id}` })
          const textNode = state.schema.text(t.title, [mark])
          const tr = state.tr.replaceWith(triggerPos, cursorPos, textNode)
          dispatch(tr)
          hide()
          editorView.focus()
        }

        function getQuery(): string {
          if (triggerPos < 0) return ''
          const cursorPos = editorView.state.selection.from
          if (cursorPos <= triggerPos) return ''
          return editorView.state.doc.textBetween(triggerPos + 1, cursorPos, '')
        }

        function filterTickets(query: string) {
          const q = query.toLowerCase()
          const tickets = getTickets()
          if (!q) {
            filtered = tickets.slice(0, 20)
          } else {
            filtered = tickets.filter(t =>
              t.title.toLowerCase().includes(q) ||
              t.id.toLowerCase().includes(q) ||
              t.type.toLowerCase().includes(q)
            ).slice(0, 20)
          }
          selectedIndex = 0
        }

        function update() {
          if (!active) return
          const query = getQuery()
          filterTickets(query)
          renderItems()
          positionDropdown()
        }

        // Check if # was typed in a valid context
        function shouldTrigger(): boolean {
          const { state } = editorView
          const { $from } = state.selection
          // Must be in a paragraph (not heading, code block, etc.)
          if ($from.parent.type.name !== 'paragraph') return false
          const pos = $from.pos
          const parentStart = $from.start()
          // Need at least one character (the '#') before cursor
          if (pos <= parentStart) return false
          const textBefore = state.doc.textBetween(parentStart, pos, '')
          if (!textBefore.endsWith('#')) return false
          if (textBefore.length === 1) return true // just '#' at start of paragraph
          const charBefore = textBefore[textBefore.length - 2]
          return charBefore === ' ' || charBefore === '\n' || charBefore === '\t'
        }

        // Key handler for when dropdown is active
        function handleKeydown(e: KeyboardEvent): boolean {
          if (!active) return false
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1)
            Array.from(dropdown.children).forEach((child, ci) => {
              ;(child as HTMLElement).style.background = ci === selectedIndex
                ? 'var(--accent,#f5f5f5)' : ''
            })
            const sel = dropdown.children[selectedIndex] as HTMLElement | undefined
            sel?.scrollIntoView({ block: 'nearest' })
            return true
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            selectedIndex = Math.max(selectedIndex - 1, 0)
            Array.from(dropdown.children).forEach((child, ci) => {
              ;(child as HTMLElement).style.background = ci === selectedIndex
                ? 'var(--accent,#f5f5f5)' : ''
            })
            const sel = dropdown.children[selectedIndex] as HTMLElement | undefined
            sel?.scrollIntoView({ block: 'nearest' })
            return true
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            selectItem(selectedIndex)
            return true
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            hide()
            return true
          }
          return false
        }

        const keydownHandler = (e: KeyboardEvent) => {
          if (handleKeydown(e)) {
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }

        // Capture phase so we intercept before ProseMirror
        editorView.dom.addEventListener('keydown', keydownHandler, true)

        // Click outside to dismiss
        const clickOutside = (e: MouseEvent) => {
          if (active && !dropdown.contains(e.target as Node)) {
            hide()
          }
        }
        document.addEventListener('mousedown', clickOutside)

        return {
          update(view) {
            editorView = view
            const { state } = view
            const { $from } = state.selection

            // Check if user just typed '#'
            if (!active) {
              if (shouldTrigger()) {
                const pos = $from.pos
                triggerPos = pos - 1 // position of the '#'
                show()
                update()
              }
              return
            }

            // Active — check if cursor moved away from trigger context
            const cursorPos = state.selection.from
            if (cursorPos <= triggerPos) {
              hide()
              return
            }
            // Check the '#' is still there
            const charAtTrigger = state.doc.textBetween(triggerPos, triggerPos + 1, '')
            if (charAtTrigger !== '#') {
              hide()
              return
            }

            update()
          },
          destroy() {
            editorView.dom.removeEventListener('keydown', keydownHandler, true)
            document.removeEventListener('mousedown', clickOutside)
            dropdown.remove()
          },
        }
      },
    })
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
