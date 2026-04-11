/**
 * Custom slash commands for the block edit menu.
 * Extends Crepe's default / menu with additional formatting commands.
 *
 * Crepe defaults already provide: Text, H1-H6, Quote, Divider, Bullet/Ordered/Task list,
 * Image, Code block, Table, Math. We add formatting marks here.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import { commandsCtx } from '@milkdown/core'
import { toggleHighlightCommand } from './highlight-mark'

type BlockEditConfig = NonNullable<NonNullable<CrepeConfig['featureConfigs']>[typeof CrepeFeature.BlockEdit]>

// Phosphor "highlighter-circle" (regular weight, 24x24 viewbox scaled to 16)
const highlightSlashIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M201.54,54.46A104,104,0,0,0,54.46,201.54,104,104,0,0,0,201.54,54.46ZM96,210V152h64v58a88.33,88.33,0,0,1-64,0Zm48-74H112V100.94l32-16Zm46.22,54.22A88.09,88.09,0,0,1,176,201.77V152a16,16,0,0,0-16-16V72a8,8,0,0,0-11.58-7.16l-48,24A8,8,0,0,0,96,96v40a16,16,0,0,0-16,16v49.77a88,88,0,1,1,110.22-11.55Z"/></svg>'

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
    },
  }
}
