import { describe, it, expect } from 'vitest'
import {
  textColorSchema,
  toggleTextColorCommand,
  textColorAttr,
  textColorPlugins,
} from '../text-color-mark'

describe('text color mark plugin', () => {
  it('exports a mark schema', () => {
    expect(textColorSchema).toBeDefined()
    expect(textColorSchema.mark).toBeDefined()
    expect(textColorSchema.ctx).toBeDefined()
  })

  it('exports a toggle command', () => {
    expect(toggleTextColorCommand).toBeDefined()
  })

  it('exports mark attributes', () => {
    expect(textColorAttr).toBeDefined()
  })

  it('exports all plugins as array', () => {
    expect(textColorPlugins).toBeDefined()
    expect(textColorPlugins.length).toBeGreaterThanOrEqual(3)
  })
})
