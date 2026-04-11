import { describe, it, expect } from 'vitest'
import {
  highlightSchema,
  highlightInputRule,
  toggleHighlightCommand,
  highlightAttr,
} from '../highlight-mark'

describe('highlight mark plugin', () => {
  it('exports a mark schema', () => {
    expect(highlightSchema).toBeDefined()
    // $markSchema returns an object with .mark and .ctx properties
    expect(highlightSchema.mark).toBeDefined()
    expect(highlightSchema.ctx).toBeDefined()
  })

  it('exports an input rule', () => {
    expect(highlightInputRule).toBeDefined()
  })

  it('exports a toggle command', () => {
    expect(toggleHighlightCommand).toBeDefined()
  })

  it('exports mark attributes', () => {
    expect(highlightAttr).toBeDefined()
  })
})
