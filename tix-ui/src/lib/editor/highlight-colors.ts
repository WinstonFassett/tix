/**
 * Highlight color palette — mirrors AFFiNE/BlockSuite's 8-color system.
 * Each color has background (for text highlight) and foreground (for text color)
 * variants, with light and dark mode values.
 */

export interface HighlightColor {
  name: string
  background: { light: string; dark: string }
  foreground: { light: string; dark: string }
}

export const highlightColors: HighlightColor[] = [
  {
    name: 'red',
    background: { light: 'rgba(254, 213, 213, 1)', dark: 'rgba(108, 39, 39, 1)' },
    foreground: { light: 'rgba(198, 34, 34, 1)', dark: 'rgba(249, 141, 141, 1)' },
  },
  {
    name: 'orange',
    background: { light: 'rgba(254, 223, 187, 1)', dark: 'rgba(112, 58, 21, 1)' },
    foreground: { light: 'rgba(211, 79, 11, 1)', dark: 'rgba(252, 168, 99, 1)' },
  },
  {
    name: 'yellow',
    background: { light: 'rgba(254, 243, 161, 1)', dark: 'rgba(106, 84, 15, 1)' },
    foreground: { light: 'rgba(182, 124, 4, 1)', dark: 'rgba(251, 214, 68, 1)' },
  },
  {
    name: 'green',
    background: { light: 'rgba(225, 250, 177, 1)', dark: 'rgba(26, 91, 50, 1)' },
    foreground: { light: 'rgba(20, 147, 67, 1)', dark: 'rgba(110, 229, 153, 1)' },
  },
  {
    name: 'teal',
    background: { light: 'rgba(173, 248, 233, 1)', dark: 'rgba(14, 85, 97, 1)' },
    foreground: { light: 'rgba(7, 130, 160, 1)', dark: 'rgba(87, 221, 204, 1)' },
  },
  {
    name: 'blue',
    background: { light: 'rgba(204, 226, 254, 1)', dark: 'rgba(56, 75, 122, 1)' },
    foreground: { light: 'rgba(33, 89, 211, 1)', dark: 'rgba(128, 183, 251, 1)' },
  },
  {
    name: 'purple',
    background: { light: 'rgba(237, 221, 255, 1)', dark: 'rgba(80, 46, 111, 1)' },
    foreground: { light: 'rgba(132, 46, 211, 1)', dark: 'rgba(205, 157, 253, 1)' },
  },
  {
    name: 'grey',
    background: { light: 'rgba(234, 236, 239, 1)', dark: 'rgba(64, 67, 74, 1)' },
    foreground: { light: 'rgba(122, 122, 122, 1)', dark: 'rgba(86, 86, 86, 1)' },
  },
]

/** Look up a color by name, returns undefined if not found */
export function getHighlightColor(name: string): HighlightColor | undefined {
  return highlightColors.find((c) => c.name === name)
}

/** Default highlight color when none specified */
export const defaultHighlightColor = 'yellow'
