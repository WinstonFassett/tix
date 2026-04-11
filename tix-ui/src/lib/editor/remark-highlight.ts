/**
 * Minimal remark plugin that transforms ==text== into highlight mdast nodes.
 * Works with Milkdown's parseMarkdown/toMarkdown handlers.
 */
import type { Plugin } from 'unified'
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

const HIGHLIGHT_REGEX = /==(.+?)==/g

export const remarkHighlight: Plugin<[], Root> = () => {
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
        // The highlight node
        parts.push({
          type: 'highlight',
          children: [{ type: 'text', value: match[1] }],
        })
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
