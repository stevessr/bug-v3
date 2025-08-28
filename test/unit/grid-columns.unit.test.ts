import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupsTab from '../options/tabs/GroupsTab.vue'
import PopupApp from '../popup/PopupApp.vue'
import store from '../data/store/main'

describe('grid columns react to settings', () => {
  beforeEach(() => {
    // reset settings to defaults
    const s = store.getSettings()
    s.gridColumns = 4
    store.saveSettings(s)
  })

  it('GroupsTab uses gridCols from settings', async () => {
    const wrapper = mount(GroupsTab, {
      global: {
        stubs: [
          'new-group-modal',
          'edit-group-modal',
          'add-emoji-modal',
          'group-import-modal',
          'import-conflict-modal',
        ],
      },
    })
    // default should be 4 columns
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).gridCols).toBe(4)

    // change settings and dispatch
    const s = store.getSettings()
    s.gridColumns = 6
    store.saveSettings(s)
    window.dispatchEvent(new CustomEvent('app:settings-changed', { detail: s }))
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).gridCols).toBe(6)
  })

  it('PopupApp reacts to settings changes', async () => {
    const wrapper = mount(PopupApp)
    await wrapper.vm.$nextTick()
    const before = wrapper.vm.gridStyle
    expect(before.gridTemplateColumns).toContain('repeat')
    const s = store.getSettings()
    s.gridColumns = 5
    store.saveSettings(s)
    window.dispatchEvent(new CustomEvent('app:settings-changed', { detail: s }))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.gridStyle.gridTemplateColumns.includes('repeat(5')).toBeTruthy()
  })
})
