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
        const color = bg ? null : null // TODO: reverse lookup from CSS value to named color
        return { color }
      },
    },
  ],
  toDOM: (mark) => {
    const colorName = mark.attrs.color || defaultHighlightColor
    return ['mark', {
      class: `highlight-${colorName}`,
      'data-highlight-color': colorName,
    }, 0]
  },
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      const color = (node as any).color || null
      state.openMark(markType, { color })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      // Pass color through to the mdast node
      state.withMark(mark, 'highlight', undefined, {
        color: mark.attrs.color,
      })
    },
  },
}))

/// A command to toggle the highlight mark.
/// When a color is provided, removes any existing highlight then applies with that color.
/// When no color is provided, toggles the mark off.
export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx) =>
    (color?: string) => {
      const markType = highlightSchema.type(ctx)
      if (!color) {
        // No color = remove highlight
        return toggleMark(markType)
      }
      // Apply with specific color: first remove, then add
      return (state, dispatch) => {
        const { from, to } = state.selection
        if (!dispatch) return true
        let tr = state.tr
        // Remove existing highlight marks in range
        tr = tr.removeMark(from, to, markType)
        // Add new mark with color
        tr = tr.addMark(from, to, markType.create({ color }))
        dispatch(tr)
        return true
      }
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
