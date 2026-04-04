import { useEffect, useRef } from 'react'

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

      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue,
      })

      crepe.on((listener: any) => {
        listener.markdownUpdated((_ctx: any, markdown: string) => {
          if (markdown !== lastValueRef.current) {
            lastValueRef.current = markdown
            onChange?.(markdown)
          }
        })
      })

      await crepe.create()
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
