<script lang="ts">
  import CommandPaletteLib from 'svelte-command-palette'
  import type { Ticket } from '../types'
  import type { Route } from '../data/router'
  import { buildPaletteItems, type PaletteCallbacks } from '../data/palette-items'

  let {
    tickets,
    route,
    callbacks,
  }: {
    tickets: Ticket[]
    route: Route
    callbacks: PaletteCallbacks
  } = $props()

  let items = $derived(buildPaletteItems(tickets, route, callbacks))
</script>

<CommandPaletteLib
  commands={items}
  placeholder="Type a command or search..."
  shortcut="$mod+k"
  overlayClass="cp-overlay-themed"
  paletteWrapperInnerClass="cp-container-themed"
  inputClass="cp-input-themed"
  resultsContainerClass="cp-results-themed"
  resultContainerClass="cp-result-themed"
  optionSelectedClass="cp-result-active"
  unstyled
/>
