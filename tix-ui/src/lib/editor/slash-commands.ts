/**
 * Custom slash commands for the block edit menu.
 * Extends Crepe's default / menu with formatting and utility commands.
 */
import type { CrepeConfig } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import { commandsCtx } from '@milkdown/core'

type BlockEditConfig = NonNullable<NonNullable<CrepeConfig['featureConfigs']>[typeof CrepeFeature.BlockEdit]>
import { toggleHighlightCommand } from './highlight-mark'
import { toggleTextColorCommand } from './text-color-mark'

// Lucide SVG icons
const highlightIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`
const textColorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>`

export function getSlashMenuConfig(): BlockEditConfig {
  return {
    buildMenu: (builder) => {
      const formatting = builder.addGroup('formatting', 'Formatting')
      formatting.addItem('highlight', {
        label: 'Highlight',
        icon: highlightIcon,
        onRun: (ctx: any) => {
          const commands = ctx.get(commandsCtx)
          commands.call(toggleHighlightCommand.key)
        },
      })
      formatting.addItem('text-color', {
        label: 'Text Color',
        icon: textColorIcon,
        onRun: (ctx: any) => {
          const commands = ctx.get(commandsCtx)
          commands.call(toggleTextColorCommand.key)
        },
      })
    },
  }
}
