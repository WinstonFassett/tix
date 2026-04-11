import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkHighlight } from '../remark-highlight'

function parse(md: string) {
  const processor = unified().use(remarkParse).use(remarkHighlight)
  return processor.runSync(processor.parse(md))
}

function findNodes(tree: any, type: string): any[] {
  const found: any[] = []
  function walk(node: any) {
    if (node.type === type) found.push(node)
    if (node.children) node.children.forEach(walk)
  }
  walk(tree)
  return found
}

describe('remarkHighlight', () => {
  it('transforms ==text== into highlight nodes', () => {
    const tree = parse('hello ==world== bye')
    const highlights = findNodes(tree, 'highlight')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].children[0].value).toBe('world')
  })

  it('handles multiple highlights in one line', () => {
    const tree = parse('==one== and ==two==')
    const highlights = findNodes(tree, 'highlight')
    expect(highlights).toHaveLength(2)
    expect(highlights[0].children[0].value).toBe('one')
    expect(highlights[1].children[0].value).toBe('two')
  })

  it('preserves surrounding text', () => {
    const tree = parse('before ==middle== after')
    const paragraph = tree.children[0] as any
    expect(paragraph.children).toHaveLength(3)
    expect(paragraph.children[0]).toEqual({ type: 'text', value: 'before ' })
    expect(paragraph.children[2]).toEqual({ type: 'text', value: ' after' })
  })

  it('does not match single equals', () => {
    const tree = parse('a = b')
    const highlights = findNodes(tree, 'highlight')
    expect(highlights).toHaveLength(0)
  })

  it('does not match empty highlights', () => {
    const tree = parse('====')
    const highlights = findNodes(tree, 'highlight')
    expect(highlights).toHaveLength(0)
  })
})
