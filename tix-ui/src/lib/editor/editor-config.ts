/**
 * Crepe editor feature configuration — extends the default toolbar with
 * custom marks (highlight, text color) and other enhancements.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { commandsCtx } from '@milkdown/core'
import { highlightSchema, toggleHighlightCommand } from './highlight-mark'
import { textColorSchema, toggleTextColorCommand } from './text-color-mark'
import { underlineSchema, toggleUnderlineCommand } from './underline-mark'
import { getSlashMenuConfig } from './slash-commands'

// Real Lucide icon SVG paths wrapped with data-mark for color-picker-plugin detection
const svgWrap = (mark: string, paths: string) =>
  `<span data-mark="${mark}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`

// Lucide "highlighter"
const highlightIcon = svgWrap('highlight',
  '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>')
// Lucide "baseline" (A with underline — standard text-color icon)
const textColorIcon = svgWrap('text-color',
  '<path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/>')
// Lucide "underline"
const underlineIcon = svgWrap('underline',
  '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>')

export function getEditorFeatureConfigs(): CrepeConfig['featureConfigs'] {
  return {
    'block-edit': getSlashMenuConfig(),
    toolbar: {
      buildToolbar: (builder) => {
        const formatting = builder.getGroup('formatting')
        formatting.addItem('highlight', {
          icon: highlightIcon,
          active: (ctx: any) => {
            const commands = ctx.get(commandsCtx)
            try {
              return commands.call('isMarkSelected', highlightSchema.type(ctx))
            } catch {
              return false
            }
          },
          onRun: () => {
            // Color picker plugin intercepts the click — no-op here
          },
        })
        formatting.addItem('underline', {
          icon: underlineIcon,
          active: (ctx: any) => {
            const commands = ctx.get(commandsCtx)
            try {
              return commands.call('isMarkSelected', underlineSchema.type(ctx))
            } catch {
              return false
            }
          },
          onRun: (ctx: any) => {
            const commands = ctx.get(commandsCtx)
            commands.call(toggleUnderlineCommand.key)
          },
        })
        formatting.addItem('text-color', {
          icon: textColorIcon,
          active: (ctx: any) => {
            const commands = ctx.get(commandsCtx)
            try {
              return commands.call('isMarkSelected', textColorSchema.type(ctx))
            } catch {
              return false
            }
          },
          onRun: () => {
            // Color picker plugin intercepts the click — no-op here
          },
        })
      },
    },
  }
}
