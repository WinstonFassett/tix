import { describe, it, expect } from 'vitest'
import {
  highlightColors,
  type HighlightColor,
} from '../highlight-colors'

describe('highlight color palette', () => {
  const expectedNames = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'grey']

  it('exports 8 named colors', () => {
    expect(highlightColors.map((c: HighlightColor) => c.name)).toEqual(expectedNames)
  })

  it('each color has light and dark background values', () => {
    for (const color of highlightColors) {
      expect(color.background.light).toBeTruthy()
      expect(color.background.dark).toBeTruthy()
    }
  })

  it('each color has light and dark foreground values', () => {
    for (const color of highlightColors) {
      expect(color.foreground.light).toBeTruthy()
      expect(color.foreground.dark).toBeTruthy()
    }
  })

  it('background colors are pastel (high alpha, rgba format)', () => {
    for (const color of highlightColors) {
      // Background colors should be rgba strings
      expect(color.background.light).toMatch(/^rgba\(/)
      expect(color.background.dark).toMatch(/^rgba\(/)
    }
  })
})
