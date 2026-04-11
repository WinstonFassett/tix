/**
 * Remark plugin that handles ==text== ↔ highlight mdast nodes.
 * Provides both parsing (md → AST) and serialization (AST → md).
 */
import type { Plugin, Processor } from 'unified'
import type { Root, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

// Extend mdast types for our custom node
declare module 'mdast' {
  interface PhrasingContentMap {
    highlight: {
      type: 'highlight'
      children: PhrasingContent[]
    }
  }
}

// Matches ==text== or =={color}text==
const HIGHLIGHT_REGEX = /==(?:\{(\w+)\})?(.+?)==/g

export const remarkHighlight: Plugin<[], Root> = function (this: Processor) {
  // Register serialization handler so mdast-util-to-markdown knows
  // how to convert highlight nodes back to ==text==
  const data = this.data() as Record<string, any>
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])
  toMarkdownExtensions.push({
    handlers: {
      highlight(node: any, _parent: any, state: any, info: any) {
        const exit = state.enter('highlight')
        const value = state.containerPhrasing(node, {
          ...info,
          before: '=',
          after: '=',
        })
        exit()
        const color = node.color
        // ==text== for default, =={color}text== for colored
        if (color && color !== 'yellow') {
          return `=={${color}}${value}==`
        }
        return `==${value}==`
      },
    },
  })

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return
      if (!node.value.includes('==')) return

      const parts: PhrasingContent[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      HIGHLIGHT_REGEX.lastIndex = 0
      while ((match = HIGHLIGHT_REGEX.exec(node.value)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: node.value.slice(lastIndex, match.index) })
        }
        // The highlight node — match[1] is optional color, match[2] is text
        const color = match[1] || null
        parts.push({
          type: 'highlight',
          color,
          children: [{ type: 'text', value: match[2] }],
        } as any)
        lastIndex = match.index + match[0].length
      }

      if (parts.length === 0) return

      // Remaining text after last match
      if (lastIndex < node.value.length) {
        parts.push({ type: 'text', value: node.value.slice(lastIndex) })
      }

      // Replace the text node with our parts
      parent.children.splice(index, 1, ...parts)
    })
  }
}
