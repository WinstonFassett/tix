/**
 * Crepe editor feature configuration — extends the default toolbar with
 * highlight mark and other enhancements.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { commandsCtx } from '@milkdown/core'
import { highlightSchema } from './highlight-mark'
import { underlineSchema, toggleUnderlineCommand } from './underline-mark'
import { getSlashMenuConfig } from './slash-commands'

// Icons: inline SVG strings with data-mark attr for color-picker-plugin detection.
const markIcon = (mark: string, svg: string) =>
  `<span data-mark="${mark}">${svg}</span>`

// Phosphor "highlighter-circle" — fits the circular picker metaphor
const highlightIcon = markIcon('highlight',
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M201.54,54.46A104,104,0,0,0,54.46,201.54,104,104,0,0,0,201.54,54.46ZM96,210V152h64v58a88.33,88.33,0,0,1-64,0Zm48-74H112V100.94l32-16Zm46.22,54.22A88.09,88.09,0,0,1,176,201.77V152a16,16,0,0,0-16-16V72a8,8,0,0,0-11.58-7.16l-48,24A8,8,0,0,0,96,96v40a16,16,0,0,0-16,16v49.77a88,88,0,1,1,110.22-11.55Z"/></svg>')
// Material Design "format-underlined"
const underlineIcon = markIcon('underline',
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>')

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
      },
    },
  }
}
