/**
 * Custom slash commands for the block edit menu.
 * Extends Crepe's default / menu with additional formatting commands.
 *
 * Crepe defaults already provide: Text, H1-H6, Quote, Divider, Bullet/Ordered/Task list,
 * Image, Code block, Table, Math. We add formatting marks here.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { toggleHighlightCommand } from './highlight-mark'

type BlockEditConfig = NonNullable<NonNullable<CrepeConfig['featureConfigs']>[typeof CrepeFeature.BlockEdit]>

// Phosphor "highlighter-circle" (regular weight, 24x24 viewbox scaled to 16)
const highlightSlashIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M201.54,54.46A104,104,0,0,0,54.46,201.54,104,104,0,0,0,201.54,54.46ZM96,210V152h64v58a88.33,88.33,0,0,1-64,0Zm48-74H112V100.94l32-16Zm46.22,54.22A88.09,88.09,0,0,1,176,201.77V152a16,16,0,0,0-16-16V72a8,8,0,0,0-11.58-7.16l-48,24A8,8,0,0,0,96,96v40a16,16,0,0,0-16,16v49.77a88,88,0,1,1,110.22-11.55Z"/></svg>'

// Phosphor "link" icon (regular weight, scaled to 16)
const linkTicketSlashIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M137.54,186.36a8,8,0,0,1,0,11.31l-9.94,10a56,56,0,0,1-79.22-79.27l24.12-24.12a56,56,0,0,1,76.81-2.28,8,8,0,1,1-10.64,12,40,40,0,0,0-54.85,1.63L59.7,139.72a40,40,0,0,0,56.58,56.58l9.94-9.94A8,8,0,0,1,137.54,186.36Zm70.08-138a56.07,56.07,0,0,0-79.22,0l-9.94,9.95a8,8,0,0,0,11.32,11.31l9.94-9.94a40,40,0,0,1,56.58,56.58L172.18,140.4a40,40,0,0,1-54.85,1.63,8,8,0,1,0-10.64,12,56,56,0,0,0,76.81-2.28l24.12-24.12A56.07,56.07,0,0,0,207.62,48.38Z"/></svg>'

export function getSlashMenuConfig(): BlockEditConfig {
  return {
    buildMenu: (builder) => {
      const formatting = builder.addGroup('formatting', 'Formatting')
      formatting.addItem('highlight', {
        label: 'Highlight',
        icon: highlightSlashIcon,
        onRun: (ctx: any) => {
          const commands = ctx.get(commandsCtx)
          commands.call(toggleHighlightCommand.key, 'yellow')
        },
      })

      const references = builder.addGroup('references', 'References')
      references.addItem('link-ticket', {
        label: 'Link ticket',
        icon: linkTicketSlashIcon,
        onRun: (ctx: any) => {
          // Insert '#' at cursor to trigger the mention plugin
          const view = ctx.get(editorViewCtx)
          const { from } = view.state.selection
          view.dispatch(view.state.tr.insertText('#', from))
        },
      })
    },
  }
}
