/**
 * Crepe editor feature configuration — extends the default toolbar with
 * highlight mark and other enhancements.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { commandsCtx } from '@milkdown/core'
import { highlightSchema } from './highlight-mark'
import { underlineSchema, toggleUnderlineCommand } from './underline-mark'
import { getSlashMenuConfig } from './slash-commands'
import { getMermaidCodeMirrorConfig } from './mermaid-preview'

// Icons: inline SVG strings with data-mark attr for color-picker-plugin detection.
const markIcon = (mark: string, svg: string) =>
  `<span data-mark="${mark}">${svg}</span>`

// Phosphor "highlighter-circle" — fits the circular picker metaphor
const highlightIcon = markIcon('highlight',
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M201.54,54.46A104,104,0,0,0,54.46,201.54,104,104,0,0,0,201.54,54.46ZM96,210V152h64v58a88.33,88.33,0,0,1-64,0Zm48-74H112V100.94l32-16Zm46.22,54.22A88.09,88.09,0,0,1,176,201.77V152a16,16,0,0,0-16-16V72a8,8,0,0,0-11.58-7.16l-48,24A8,8,0,0,0,96,96v40a16,16,0,0,0-16,16v49.77a88,88,0,1,1,110.22-11.55Z"/></svg>')
// Phosphor "text-underline" (regular weight)
const underlineIcon = markIcon('underline',
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M200,224a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H192A8,8,0,0,1,200,224Zm-72-24a64.07,64.07,0,0,0,64-64V56a8,8,0,0,0-16,0v80a48,48,0,0,1-96,0V56a8,8,0,0,0-16,0v80A64.07,64.07,0,0,0,128,200Z"/></svg>')

export function getEditorFeatureConfigs(): CrepeConfig['featureConfigs'] {
  return {
    'block-edit': getSlashMenuConfig(),
    'code-mirror': getMermaidCodeMirrorConfig(),
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
