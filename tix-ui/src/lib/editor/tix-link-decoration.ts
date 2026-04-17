/**
 * Renders `[text](tix:<id>)` links as styled chips with a status dot.
 * Hover shows popover with: editable href input, open button, unlink button.
 * Click on chip text navigates to the ticket.
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

interface TicketInfo {
  id: string
  title: string
  status: string
}

const tixLinkKey = new PluginKey('tix-link-decoration')

const STATUS_COLORS: Record<string, string> = {
  'open':        '#f97316',
  'in-progress': '#facc15',
  'review':      '#22d3ee',
  'on-hold':     '#94a3b8',
  'done':        '#8b5cf6',
  'closed':      '#94a3b8',
}

const ICON_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
const ICON_UNLINK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18.84 12.25 1.72-1.71a4.05 4.05 0 0 0-5.73-5.73l-1.71 1.72"/><path d="m5.17 11.75-1.71 1.71a4.05 4.05 0 0 0 5.73 5.73l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'

export function createTixLinkPlugin(
  getTickets: () => TicketInfo[],
  onNavigate?: (ticketId: string) => void,
) {
  return $prose(() => {
    return new Plugin({
      key: tixLinkKey,
      view(editorView) {
        // --- Popover ---
        const popover = document.createElement('div')
        popover.className = 'tix-link-popover'
        popover.style.cssText = `
          display:none;position:fixed;z-index:9999;
          background:var(--popover,#fff);color:var(--popover-foreground,#111);
          border:1px solid var(--border,#e5e5e5);border-radius:8px;
          box-shadow:0 4px 12px rgba(0,0,0,0.15);
          padding:6px;gap:4px;align-items:center;
          font-size:13px;
        `
        document.body.appendChild(popover)

        const input = document.createElement('input')
        input.type = 'text'
        input.style.cssText = `
          flex:1;min-width:120px;padding:4px 8px;
          font-size:13px;font-family:monospace;
          background:var(--muted,#f5f5f5);color:var(--foreground,#111);
          border:1px solid var(--border,#e5e5e5);border-radius:4px;
          outline:none;
        `

        function iconBtn(icon: string, title: string): HTMLButtonElement {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.title = title
          btn.innerHTML = icon
          btn.style.cssText = `
            display:inline-flex;align-items:center;justify-content:center;
            width:28px;height:28px;border-radius:4px;border:none;
            background:transparent;color:var(--muted-foreground,#888);
            cursor:pointer;flex-shrink:0;
          `
          btn.addEventListener('mouseenter', () => {
            btn.style.background = 'var(--accent,#f0f0f0)'
            btn.style.color = 'var(--foreground,#111)'
          })
          btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent'
            btn.style.color = 'var(--muted-foreground,#888)'
          })
          return btn
        }

        const openBtn = iconBtn(ICON_OPEN, 'Open ticket')
        const unlinkBtn = iconBtn(ICON_UNLINK, 'Remove link')

        popover.appendChild(input)
        popover.appendChild(openBtn)
        popover.appendChild(unlinkBtn)

        // --- State ---
        let activeMark: { from: number; to: number; href: string } | null = null

        function showPopover(rect: DOMRect, from: number, to: number, href: string) {
          activeMark = { from, to, href }
          input.value = href

          popover.style.display = 'flex'
          let top = rect.bottom + 4
          let left = rect.left
          const pRect = popover.getBoundingClientRect()
          if (top + pRect.height > window.innerHeight) top = rect.top - pRect.height - 4
          if (left + pRect.width > window.innerWidth) left = window.innerWidth - pRect.width - 8
          popover.style.top = `${top}px`
          popover.style.left = `${left}px`
        }

        function hidePopover() {
          popover.style.display = 'none'
          activeMark = null
        }

        function saveEdit() {
          if (!activeMark) return
          const newHref = input.value.trim()
          if (!newHref || newHref === activeMark.href) return
          const { state, dispatch } = editorView
          const linkMark = state.schema.marks.link
          if (!linkMark) return
          const tr = state.tr
          tr.removeMark(activeMark.from, activeMark.to, linkMark)
          tr.addMark(activeMark.from, activeMark.to, linkMark.create({ href: newHref }))
          dispatch(tr)
          activeMark.href = newHref
        }

        function removeLink() {
          if (!activeMark) return
          const { state, dispatch } = editorView
          const linkMark = state.schema.marks.link
          if (!linkMark) return
          dispatch(state.tr.removeMark(activeMark.from, activeMark.to, linkMark))
          hidePopover()
          editorView.focus()
        }

        // --- Button handlers ---
        openBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          if (!activeMark) return
          const ticketId = activeMark.href.replace('tix:', '')
          hidePopover()
          onNavigate?.(ticketId)
        })

        unlinkBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          removeLink()
        })

        // Save on Enter, close on Escape, save on blur
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
          if (e.key === 'Escape') { e.preventDefault(); hidePopover(); editorView.focus() }
        })
        input.addEventListener('blur', () => saveEdit())

        // Click on tix: chip → show popover. Click outside → close.
        const onClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement
          const chip = target.closest('.tix-link-chip') as HTMLElement | null

          // Click outside popover and chip → close
          if (!chip && !popover.contains(target)) {
            if (popover.style.display !== 'none') {
              saveEdit()
              hidePopover()
            }
            return
          }
          if (!chip || !editorView.dom.contains(chip)) return

          // Find ProseMirror position and link mark for this chip
          const pos = editorView.posAtDOM(chip, 0)
          if (pos == null) return
          const resolved = editorView.state.doc.resolve(pos)
          const marks = resolved.marks()
          const mark = marks.find(m => m.type.name === 'link' && m.attrs.href?.startsWith('tix:'))
          if (!mark) return

          // Find mark extent
          const $pos = editorView.state.doc.resolve(pos)
          let from = pos, to = pos
          $pos.parent.forEach((child, childOffset) => {
            const childFrom = $pos.start() + childOffset
            const childTo = childFrom + child.nodeSize
            if (childFrom <= pos && pos < childTo && child.marks.some(m => m === mark)) {
              from = childFrom
              to = childTo
            }
          })

          e.preventDefault()
          showPopover(chip.getBoundingClientRect(), from, to, mark.attrs.href)
        }
        document.addEventListener('mousedown', onClick)

        return {
          update(view) {
            editorView = view
          },
          destroy() {
            document.removeEventListener('mousedown', onClick)
            popover.remove()
          },
        }
      },
      state: {
        init(_, state) {
          return buildDecorations(state, getTickets)
        },
        apply(tr, old, _, newState) {
          if (tr.docChanged) {
            return buildDecorations(newState, getTickets)
          }
          return old
        },
      },
      props: {
        decorations(state) {
          return this.getState(state)
        },
      },
    })
  })
}

function buildDecorations(
  state: any,
  getTickets: () => TicketInfo[],
): DecorationSet {
  const decorations: Decoration[] = []
  const tickets = getTickets()
  const ticketMap = new Map(tickets.map((t) => [t.id, t]))

  state.doc.descendants((node: any, pos: number) => {
    if (!node.isInline || !node.marks) return

    for (const mark of node.marks) {
      if (mark.type.name !== 'link') continue
      const href: string = mark.attrs.href ?? ''
      if (!href.startsWith('tix:')) continue

      const ticketId = href.replace('tix:', '')
      const ticket = ticketMap.get(ticketId)
      const statusColor = ticket
        ? STATUS_COLORS[ticket.status] ?? '#94a3b8'
        : '#94a3b8'

      const from = pos
      const to = pos + node.nodeSize

      decorations.push(
        Decoration.inline(from, to, {
          class: 'tix-link-chip',
          style: `--tix-status-color:${statusColor}`,
        })
      )

      decorations.push(
        Decoration.widget(from, () => {
          const dot = document.createElement('span')
          dot.className = 'tix-link-dot'
          dot.style.cssText = `
            display:inline-block;width:8px;height:8px;
            border-radius:50%;background:${statusColor};
            margin-right:4px;vertical-align:middle;flex-shrink:0;
          `
          return dot
        }, { side: -1, key: `tix-dot-${ticketId}-${from}` })
      )
    }
  })

  return DecorationSet.create(state.doc, decorations)
}
