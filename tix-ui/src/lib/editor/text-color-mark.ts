/**
 * Custom Milkdown mark plugin for text foreground color.
 * Unlike highlight (background), this changes the text color itself.
 *
 * No markdown syntax for this — it's toolbar-only, serialized as
 * <span style="color:..."> in HTML within markdown.
 */
import { toggleMark } from '@milkdown/prose/commands'
import { $command, $markAttr, $markSchema } from '@milkdown/utils'
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
    const attrs = ctx.get(textColorAttr.key)(mark)
    const colorName = mark.attrs.color
    const colorDef = colorName ? getHighlightColor(colorName) : undefined
    const style = colorDef
      ? `color: ${colorDef.foreground.light}`
      : undefined
    return ['span', { ...attrs, 'data-text-color': colorName, style }, 0]
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
      state.withMark(mark, 'textColor')
    },
  },
}))

/// A command to toggle the text color mark.
export const toggleTextColorCommand = $command(
  'ToggleTextColor',
  (ctx) =>
    (color?: string) => {
      const attrs = color ? { color } : {}
      return toggleMark(textColorSchema.type(ctx), attrs)
    }
)

/// All plugins needed for text color support
export const textColorPlugins = [
  textColorAttr,
  textColorSchema,
  toggleTextColorCommand,
] as const
