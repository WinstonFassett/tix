/**
 * Custom Milkdown mark plugin for text foreground color.
 * Unlike highlight (background), this changes the text color itself.
 *
 * No markdown syntax for this — it's toolbar-only, serialized as
 * <span style="color:..."> in HTML within markdown.
 */
import { toggleMark } from '@milkdown/prose/commands'
import { $command, $markAttr, $markSchema, $remark } from '@milkdown/utils'
import { getHighlightColor } from './highlight-colors'

/// HTML attributes for the text color mark.
export const textColorAttr = $markAttr('text_color')

/// Text color mark schema.
export const textColorSchema = $markSchema('text_color', (ctx) => ({
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-text-color]',
      getAttrs: (node) => {
        if (typeof node === 'string') return {}
        return { color: (node as HTMLElement).getAttribute('data-text-color') }
      },
    },
    {
      style: 'color',
      getAttrs: (value) => {
        if (!value || value === 'inherit') return false as false
        return {}
      },
    },
  ],
  toDOM: (mark) => {
    const colorName = mark.attrs.color || 'red'
    return ['span', {
      class: `text-color-${colorName}`,
      'data-text-color': colorName,
    }, 0]
  },
  parseMarkdown: {
    match: (node) => node.type === 'textColor',
    runner: (state, node, markType) => {
      state.openMark(markType, { color: node.color })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'text_color',
    runner: (state, mark) => {
      state.withMark(mark, 'textColor', undefined, {
        color: mark.attrs.color,
      })
    },
  },
}))

/// A command to toggle the text color mark.
/// When a color is provided, removes existing then applies with that color.
/// When no color, removes the mark.
export const toggleTextColorCommand = $command(
  'ToggleTextColor',
  (ctx) =>
    (color?: string) => {
      const markType = textColorSchema.type(ctx)
      if (!color) {
        return toggleMark(markType)
      }
      return (state, dispatch) => {
        const { from, to } = state.selection
        if (!dispatch) return true
        let tr = state.tr
        tr = tr.removeMark(from, to, markType)
        tr = tr.addMark(from, to, markType.create({ color }))
        dispatch(tr)
        return true
      }
    }
)

/// Remark plugin to handle textColor serialization (→ inline HTML)
const remarkTextColor = $remark('remarkTextColor', () => function (this: any) {
  const data = this.data() as Record<string, any>
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])
  toMarkdownExtensions.push({
    handlers: {
      textColor(node: any, _parent: any, state: any, info: any) {
        const exit = state.enter('textColor')
        const value = state.containerPhrasing(node, info)
        exit()
        const color = node.color || 'red'
        return `<span data-text-color="${color}">${value}</span>`
      },
    },
  })
})

/// All plugins needed for text color support
export const textColorPlugins = [
  remarkTextColor,
  textColorAttr,
  textColorSchema,
  toggleTextColorCommand,
] as const
