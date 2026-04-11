import { describe, it, expect } from 'vitest'
import {
  underlineSchema,
  toggleUnderlineCommand,
  underlinePlugins,
} from '../underline-mark'

describe('underline mark plugin', () => {
  it('exports a mark schema', () => {
    expect(underlineSchema).toBeDefined()
    expect(underlineSchema.mark).toBeDefined()
  })

  it('exports a toggle command', () => {
    expect(toggleUnderlineCommand).toBeDefined()
  })

  it('exports all plugins', () => {
    expect(underlinePlugins.length).toBeGreaterThanOrEqual(3)
  })
})
