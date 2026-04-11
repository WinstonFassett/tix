/**
 * Underline mark plugin for Milkdown.
 * Not standard markdown, but common in rich text editors.
 * Serializes as <u> tag in HTML within markdown.
 */
import { toggleMark } from '@milkdown/prose/commands'
import { $command, $markAttr, $markSchema, $useKeymap } from '@milkdown/utils'
import { commandsCtx } from '@milkdown/core'

/// HTML attributes for the underline mark.
export const underlineAttr = $markAttr('underline')

/// Underline mark schema.
export const underlineSchema = $markSchema('underline', (ctx) => ({
  parseDOM: [
    { tag: 'u' },
    {
      style: 'text-decoration',
      getAttrs: (value) => (value === 'underline') as false,
    },
  ],
  toDOM: (mark) => ['u', ctx.get(underlineAttr.key)(mark), 0],
  parseMarkdown: {
    match: (node) => node.type === 'underline',
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'underline',
    runner: (state, mark) => {
      state.withMark(mark, 'underline')
    },
  },
}))

/// A command to toggle the underline mark.
export const toggleUnderlineCommand = $command(
  'ToggleUnderline',
  (ctx) => () => toggleMark(underlineSchema.type(ctx))
)

/// Keymap: Mod-u to toggle underline.
export const underlineKeymap = $useKeymap('underlineKeymap', {
  ToggleUnderline: {
    shortcuts: 'Mod-u',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(toggleUnderlineCommand.key)
    },
  },
})

/// All plugins needed for underline support
export const underlinePlugins = [
  underlineAttr,
  underlineSchema,
  toggleUnderlineCommand,
  underlineKeymap,
] as const
