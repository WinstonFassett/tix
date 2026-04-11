/**
 * Combined color swatch picker for highlight (background) and text color marks.
 * Single panel with two sections: "Color" (foreground) and "Background" (highlight).
 * Inspired by AFFiNE/Linear's highlight color picker.
 */
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import { commandsCtx } from '@milkdown/core'
import { highlightColors } from './highlight-colors'
import { toggleHighlightCommand } from './highlight-mark'
import { toggleTextColorCommand } from './text-color-mark'

const PICKER_KEY = new PluginKey('color-picker')

function createSwatchGrid(
  prefix: string,
  onSelect: (color: string) => void,
): HTMLDivElement {
  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:4px;'

  for (const color of highlightColors) {
    const swatch = document.createElement('button')
    swatch.type = 'button'
    swatch.title = color.name
    swatch.className = `${prefix}-${color.name}`
    swatch.style.cssText = `
      width:32px;height:32px;border-radius:6px;border:1.5px solid transparent;
      cursor:pointer;transition:border-color 0.15s,transform 0.1s;
    `
    if (prefix === 'text-color') {
      swatch.style.backgroundColor = 'currentColor'
    }
    swatch.addEventListener('mouseenter', () => {
      swatch.style.borderColor = 'var(--ring,#999)'
      swatch.style.transform = 'scale(1.1)'
    })
    swatch.addEventListener('mouseleave', () => {
      swatch.style.borderColor = 'transparent'
      swatch.style.transform = 'scale(1)'
    })
    swatch.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(color.name)
    })
    grid.appendChild(swatch)
  }
  return grid
}

function createSection(
  label: string,
  prefix: string,
  onSelect: (color: string) => void,
  onClear: () => void,
): HTMLDivElement {
  const section = document.createElement('div')

  const heading = document.createElement('div')
  heading.textContent = label
  heading.style.cssText = 'font-size:11px;font-weight:600;color:var(--muted-foreground,#888);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;'
  section.appendChild(heading)

  section.appendChild(createSwatchGrid(prefix, onSelect))

  const clear = document.createElement('button')
  clear.type = 'button'
  clear.textContent = `Remove ${label}`
  clear.style.cssText = 'margin-top:4px;width:100%;padding:3px;font-size:11px;color:var(--muted-foreground,#888);background:none;border:1px solid var(--border,#e5e5e5);border-radius:4px;cursor:pointer;'
  clear.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClear()
  })
  section.appendChild(clear)

  return section
}

export const colorPickerPlugin = $prose((ctx) => {
  return new Plugin({
    key: PICKER_KEY,
    view(editorView) {
      // Create picker container
      const picker = document.createElement('div')
      picker.className = 'milkdown-color-picker'
      picker.style.cssText = `
        display: none;
        position: fixed;
        z-index: 100;
        background: var(--popover, #fff);
        border: 1px solid var(--border, #e5e5e5);
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 176px;
      `
      document.body.appendChild(picker)

      function hide() {
        picker.style.display = 'none'
      }

      function show(mode: 'highlight' | 'text-color', anchorRect: DOMRect) {
        picker.innerHTML = ''

        if (mode === 'text-color') {
          // Text color button: show Color section + Background section
          picker.appendChild(createSection(
            'Color',
            'text-color',
            (colorName) => {
              ctx.get(commandsCtx).call(toggleTextColorCommand.key, colorName)
              hide()
              editorView.focus()
            },
            () => {
              ctx.get(commandsCtx).call(toggleTextColorCommand.key)
              hide()
              editorView.focus()
            },
          ))

          const divider = document.createElement('div')
          divider.style.cssText = 'height:1px;background:var(--border,#e5e5e5);margin:8px 0;'
          picker.appendChild(divider)
        }

        // Background (highlight) section — always shown
        picker.appendChild(createSection(
          'Background',
          'highlight',
          (colorName) => {
            ctx.get(commandsCtx).call(toggleHighlightCommand.key, colorName)
            hide()
            editorView.focus()
          },
          () => {
            ctx.get(commandsCtx).call(toggleHighlightCommand.key)
            hide()
            editorView.focus()
          },
        ))

        // Position below anchor
        picker.style.display = 'block'
        const pickerRect = picker.getBoundingClientRect()
        let top = anchorRect.bottom + 4
        let left = anchorRect.left

        if (top + pickerRect.height > window.innerHeight) {
          top = anchorRect.top - pickerRect.height - 4
        }
        if (left + pickerRect.width > window.innerWidth) {
          left = window.innerWidth - pickerRect.width - 8
        }

        picker.style.top = `${top}px`
        picker.style.left = `${left}px`
      }

      // Intercept pointerdown on our toolbar buttons (highlight or text-color)
      function handlePointerDown(e: PointerEvent) {
        const target = e.target as HTMLElement
        const btn = target.closest('.toolbar-item') as HTMLElement | null

        if (!btn) {
          if (!picker.contains(target)) hide()
          return
        }

        const isHighlightBtn = !!btn.querySelector('[data-mark="highlight"]')
        const isTextColorBtn = !!btn.querySelector('[data-mark="text-color"]')

        if (isHighlightBtn || isTextColorBtn) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          const mode = isHighlightBtn ? 'highlight' as const : 'text-color' as const
          const rect = btn.getBoundingClientRect()
          if (picker.style.display !== 'none') {
            hide()
          } else {
            show(mode, rect)
          }
        }
      }

      function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement
        if (!picker.contains(target) && !target.closest('.toolbar-item')) {
          hide()
        }
      }

      document.addEventListener('pointerdown', handlePointerDown, true)
      document.addEventListener('mousedown', handleClickOutside, true)

      return {
        destroy() {
          document.removeEventListener('pointerdown', handlePointerDown, true)
          document.removeEventListener('mousedown', handleClickOutside, true)
          picker.remove()
        },
      }
    },
  })
})
