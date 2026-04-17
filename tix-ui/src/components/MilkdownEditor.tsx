import { useEffect, useRef } from 'react'
import { highlightPlugins } from '#/lib/editor/highlight-mark'
import { underlinePlugins } from '#/lib/editor/underline-mark'
import { colorPickerPlugin } from '#/lib/editor/color-picker-plugin'
import { mermaidPlugin } from '#/lib/editor/mermaid-preview'
import { createTicketMentionPlugin } from '#/lib/editor/ticket-mention-plugin'
import { createTixLinkPlugin } from '#/lib/editor/tix-link-decoration'
import { getEditorFeatureConfigs } from '#/lib/editor/editor-config'

interface TicketInfo {
  id: string
  title: string
  status: string
  type: string
  priority: number
}

interface MilkdownEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  /** Raw keystroke signal — fires on every DOM input event, before Milkdown's
   *  internal 200ms debounce serializes markdown. Use to reset debounce timers. */
  onInput?: () => void
  /** Ticket list for mention picker and link chip rendering */
  tickets?: TicketInfo[]
  /** Called when a tix: link chip is clicked */
  onNavigateTicket?: (ticketId: string) => void
}

export function MilkdownEditor({ defaultValue = '', onChange, onInput, tickets, onNavigateTicket }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<any>(null)
  const lastValueRef = useRef(defaultValue)
  const onInputRef = useRef(onInput)
  onInputRef.current = onInput
  const ticketsRef = useRef(tickets ?? [])
  ticketsRef.current = tickets ?? []
  const onNavigateRef = useRef(onNavigateTicket)
  onNavigateRef.current = onNavigateTicket

  useEffect(() => {
    let destroyed = false

    async function init() {
      const { Crepe } = await import('@milkdown/crepe')
      await import('@milkdown/crepe/theme/common/style.css')
      await import('@milkdown/crepe/theme/frame.css')

      if (destroyed || !containerRef.current) return

      const { CrepeFeature } = await import('@milkdown/crepe')
      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue,
        features: {
          [CrepeFeature.Latex]: false,
          [CrepeFeature.LinkTooltip]: false,
        },
        featureConfigs: getEditorFeatureConfigs(),
      })

      // Register custom plugins before creating
      const mentionPlugin = createTicketMentionPlugin(() => ticketsRef.current)
      const tixLinkPlugin = createTixLinkPlugin(
        () => ticketsRef.current,
        (id) => onNavigateRef.current?.(id),
      )
      crepe.editor
        .use(highlightPlugins as any)
        .use(underlinePlugins as any)
        .use(colorPickerPlugin as any)
        .use(mermaidPlugin as any)
        .use(mentionPlugin as any)
        .use(tixLinkPlugin as any)

      let initialized = false
      crepe.on((listener: any) => {
        listener.markdownUpdated((_ctx: any, markdown: string) => {
          if (!initialized) return
          if (markdown !== lastValueRef.current) {
            lastValueRef.current = markdown
            onChange?.(markdown)
          }
        })
      })

      await crepe.create()
      initialized = true
      lastValueRef.current = crepe.getMarkdown()
      crepeRef.current = crepe

      // Raw DOM input listener — fires on every keystroke, before Milkdown's
      // 200ms debounce. Lets the consumer reset debounce timers.
      const el = containerRef.current
      if (el) {
        const handler = () => onInputRef.current?.()
        el.addEventListener('input', handler)
        // stash for cleanup
        ;(crepe as any).__inputHandler = handler
        ;(crepe as any).__inputEl = el
      }
    }

    init()

    return () => {
      destroyed = true
      const c = crepeRef.current
      if (c) {
        const handler = (c as any).__inputHandler
        const el = (c as any).__inputEl
        if (handler && el) el.removeEventListener('input', handler)
        c.destroy()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="milkdown-editor prose prose-sm max-w-none dark:prose-invert" />
  )
}
