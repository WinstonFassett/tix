/**
 * Custom Milkdown mark plugin for ==highlight== syntax.
 * Follows the same pattern as @milkdown/preset-gfm strikethrough.
 *
 * Supports an optional `color` attribute for colored highlights.
 * Serializes to <mark> in HTML within markdown.
 */
import { markRule } from '@milkdown/prose'
import { toggleMark } from '@milkdown/prose/commands'
import { $command, $inputRule, $markAttr, $markSchema, $remark } from '@milkdown/utils'
import { defaultHighlightColor, getHighlightColor } from './highlight-colors'
import { remarkHighlight as remarkHighlightPlugin } from './remark-highlight'

/// HTML attributes for the highlight mark.
export const highlightAttr = $markAttr('highlight')

/// Highlight mark schema.
export const highlightSchema = $markSchema('highlight', (ctx) => ({
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      tag: 'mark',
      getAttrs: (node) => {
        if (typeof node === 'string') return {}
        const bg = (node as HTMLElement).style.backgroundColor
        // Try to match back to a named color
        const color = bg ? null : null // TODO: reverse lookup from CSS value
        return { color }
      },
    },
  ],
  toDOM: (mark) => {
    const attrs = ctx.get(highlightAttr.key)(mark)
    const colorName = mark.attrs.color || defaultHighlightColor
    const colorDef = getHighlightColor(colorName)
    const style = colorDef
      ? `background-color: ${colorDef.background.light}`
      : undefined
    return ['mark', { ...attrs, style }, 0]
  },
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight')
    },
  },
}))

/// A command to toggle the highlight mark.
export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx) =>
    (color?: string) => {
      const attrs = color ? { color } : {}
      return toggleMark(highlightSchema.type(ctx), attrs)
    }
)

/// Input rule: ==text== creates a highlight mark.
export const highlightInputRule = $inputRule((ctx) => {
  return markRule(
    /(?<!=)(={2})(.+?)\1(?!=)/,
    highlightSchema.type(ctx)
  )
})

/// Remark plugin that parses ==text== in markdown source
export const remarkHighlightMilkdown = $remark('remarkHighlight', () => remarkHighlightPlugin)

/// All plugins needed for highlight support — pass to editor.use()
export const highlightPlugins = [
  remarkHighlightMilkdown,
  highlightAttr,
  highlightSchema,
  toggleHighlightCommand,
  highlightInputRule,
] as const
