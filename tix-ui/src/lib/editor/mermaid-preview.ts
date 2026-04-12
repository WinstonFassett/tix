/**
 * Mermaid diagram preview for Milkdown/Crepe code blocks.
 *
 * Uses Crepe's renderPreview callback to detect ```mermaid blocks
 * and render them as SVG diagrams via mermaid.js.
 *
 * The code block stays editable in CodeMirror; the preview renders below.
 * Uses the async applyPreview callback since mermaid.render() is async.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'

type CodeMirrorConfig = NonNullable<NonNullable<CrepeConfig['featureConfigs']>[typeof CrepeFeature.CodeMirror]>

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

/**
 * Returns a Crepe CodeMirror featureConfig with mermaid renderPreview.
 */
export function getMermaidCodeMirrorConfig(): CodeMirrorConfig {
  return {
    renderPreview: (language, content, applyPreview) => {
      const lang = language.toLowerCase()
      if ((lang === 'mermaid' || lang === 'mmd') && content.trim().length > 0) {
        // Async render — return undefined to signal async, call applyPreview when done
        const id = `mermaid-${++renderCounter}`
        ;(async () => {
          try {
            await ensureMermaidInit()
            const { default: mermaid } = await import('mermaid')
            const { svg } = await mermaid.render(id, content)
            const wrapper = `<div style="display:flex;justify-content:center;padding:12px 0;">${svg}</div>`
            applyPreview(wrapper)
          } catch (err: any) {
            const msg = (err.message || String(err)).replace(/</g, '&lt;')
            applyPreview(`<div style="color:var(--crepe-color-error,#f66);font-size:13px;padding:8px;">Mermaid: ${msg}</div>`)
          }
        })()
        // Return undefined → Crepe shows "loading" placeholder, then applyPreview replaces it
        return undefined as any
      }
      // Not mermaid — return null to skip preview
      return null
    },
  }
}
