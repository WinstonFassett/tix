import { describe, it, expect } from 'vitest'
import { getSlashMenuConfig } from '../slash-commands'

describe('slash commands config', () => {
  it('provides a buildMenu callback', () => {
    const config = getSlashMenuConfig()
    expect(config.buildMenu).toBeTypeOf('function')
  })

  it('buildMenu adds a formatting group with highlight command', () => {
    const config = getSlashMenuConfig()
    const items: Record<string, any[]> = {}
    const mockGroup = (key: string) => ({
      group: { key, label: key, items: [] as any[] },
      addItem: (itemKey: string, item: any) => {
        if (!items[key]) items[key] = []
        items[key].push({ key: itemKey, ...item })
        return mockGroup(key)
      },
      clear: () => mockGroup(key),
    })
    const mockBuilder = {
      getGroup: (key: string) => mockGroup(key),
      addGroup: (key: string, _label: string) => mockGroup(key),
    }

    config.buildMenu!(mockBuilder as any)
    expect(items['formatting']).toBeDefined()
    const keys = items['formatting'].map((i: any) => i.key)
    expect(keys).toContain('highlight')
  })
})
