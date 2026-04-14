import { useEffect, useRef } from 'react'
import { highlightPlugins } from '#/lib/editor/highlight-mark'
import { underlinePlugins } from '#/lib/editor/underline-mark'
import { colorPickerPlugin } from '#/lib/editor/color-picker-plugin'
import { mermaidPlugin } from '#/lib/editor/mermaid-preview'
import { getEditorFeatureConfigs } from '#/lib/editor/editor-config'

interface MilkdownEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
}

export function MilkdownEditor({ defaultValue = '', onChange }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<any>(null)
  const lastValueRef = useRef(defaultValue)

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
        },
        featureConfigs: getEditorFeatureConfigs(),
      })

      // Register custom plugins before creating
      crepe.editor
        .use(highlightPlugins as any)
        .use(underlinePlugins as any)
        .use(colorPickerPlugin as any)
        .use(mermaidPlugin as any)

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
    }

    init()

    return () => {
      destroyed = true
      crepeRef.current?.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="milkdown-editor prose prose-sm max-w-none dark:prose-invert" />
  )
}
