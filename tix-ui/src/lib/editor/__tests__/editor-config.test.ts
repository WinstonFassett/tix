import { describe, it, expect } from 'vitest'
import { getEditorFeatureConfigs } from '../editor-config'

describe('editor feature configs', () => {
  it('provides a buildToolbar callback', () => {
    const configs = getEditorFeatureConfigs()!
    expect(configs.toolbar).toBeDefined()
    expect(configs.toolbar!.buildToolbar).toBeTypeOf('function')
  })

  it('buildToolbar adds highlight item to formatting group', () => {
    const configs = getEditorFeatureConfigs()!
    // Simulate the GroupBuilder API
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

    configs.toolbar!.buildToolbar!(mockBuilder as any)
    expect(items['formatting']).toBeDefined()
    const keys = items['formatting'].map((i: any) => i.key)
    expect(keys).toContain('highlight')
    expect(keys).toContain('underline')
    expect(keys).toContain('text-color')
  })
})
