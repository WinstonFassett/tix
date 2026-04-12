/**
 * Mermaid diagram preview for Milkdown code blocks.
 *
 * Uses a ProseMirror plugin (via $prose) to add widget decorations below
 * mermaid code blocks. This bypasses Crepe's preview panel entirely,
 * avoiding its DOMPurify sanitization which strips <foreignObject> labels.
 *
 * The mermaid SVG is rendered directly into the DOM — no sanitization needed
 * because mermaid.render() produces trusted output.
 */
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

let mermaidInitialized = false
let renderCounter = 0

async function ensureMermaidInit() {
  if (mermaidInitialized) return
  const { default: mermaid } = await import('mermaid')
  const isDark = document.documentElement.classList.contains('dark')
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
  })
  mermaidInitialized = true
}

const mermaidPluginKey = new PluginKey('mermaid-preview')

export const mermaidPlugin = $prose(() => {
  // Cache rendered SVGs by content hash to avoid re-rendering on every keystroke
  const cache = new Map<string, string>()
  // Track pending renders to avoid duplicates
  const pending = new Set<string>()

  return new Plugin({
    key: mermaidPluginKey,
    state: {
      init(_, state) {
        return buildDecorations(state)
      },
      apply(tr, old, _, newState) {
        if (tr.docChanged || tr.getMeta(mermaidPluginKey)) {
          return buildDecorations(newState)
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

  function buildDecorations(state: any): DecorationSet {
    const decorations: Decoration[] = []
    state.doc.descendants((node: any, pos: number) => {
      if (node.type.name !== 'code_block') return
      const lang = (node.attrs.language || '').toLowerCase()
      if (lang !== 'mermaid' && lang !== 'mmd') return

      const content = node.textContent
      if (!content.trim()) return

      // Create a widget decoration after the code block
      const deco = Decoration.widget(pos + node.nodeSize, (view) => {
        const container = document.createElement('div')
        container.className = 'mermaid-preview-container'
        container.style.cssText = 'display:flex;justify-content:center;padding:16px 0;border-top:1px solid var(--crepe-color-outline, #e0e0e0);margin-top:4px;'

        const cached = cache.get(content)
        if (cached) {
          container.innerHTML = cached
          return container
        }

        container.innerHTML = '<span style="color:var(--crepe-color-on-surface-variant,#999);font-size:13px;">Rendering diagram...</span>'

        // Async render
        if (!pending.has(content)) {
          pending.add(content)
          const id = `mermaid-${++renderCounter}`
          ;(async () => {
            try {
              await ensureMermaidInit()
              const { default: mermaid } = await import('mermaid')
              const { svg } = await mermaid.render(id, content)
              cache.set(content, svg)
              pending.delete(content)
              // Trigger a re-render by dispatching a no-op transaction
              if (view && !view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(mermaidPluginKey, 'rendered'))
              }
            } catch (err: any) {
              const msg = (err.message || String(err)).replace(/</g, '&lt;')
              const errorHtml = `<span style="color:var(--crepe-color-error,#f66);font-size:13px;">Mermaid: ${msg}</span>`
              cache.set(content, errorHtml)
              pending.delete(content)
              if (view && !view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(mermaidPluginKey, 'error'))
              }
            }
          })()
        }

        return container
      }, { side: 1 })

      decorations.push(deco)
    })

    return DecorationSet.create(state.doc, decorations)
  }
})
