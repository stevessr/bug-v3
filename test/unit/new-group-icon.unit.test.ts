import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NewGroupModal from '../options/components/NewGroupModal.vue'

describe('NewGroupModal icon parsing', () => {
  it('parses URL in auto mode', async () => {
    const wrapper = mount(NewGroupModal, {
      props: { modelValue: true },
      global: { stubs: ['a-modal', 'a-form', 'a-input', 'a-radio-group', 'a-radio'] },
    })
    await wrapper.vm.$nextTick()
    ;(wrapper.vm as any).iconInput = 'https://example.com/icon.png'
    ;(wrapper.vm as any).mode = 'auto'
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).iconPreview).toBe('https://example.com/icon.png')
    expect((wrapper.vm as any).isUrlPreview).toBe(true)
  })

  it('parses text in text mode and emits created with icon', async () => {
    const wrapper = mount(NewGroupModal, {
      props: { modelValue: true },
      global: { stubs: ['a-modal', 'a-form', 'a-input', 'a-radio-group', 'a-radio'] },
    })
    ;(wrapper.vm as any).iconInput = 'AB'
    ;(wrapper.vm as any).mode = 'text'
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).iconPreview).toBe('AB')
    expect((wrapper.vm as any).isUrlPreview).toBe(false)
    ;(wrapper.vm as any).name = 'MyGroup'
    await (wrapper.vm as any).onOk()
    const emitted = wrapper.emitted('created')
    expect(emitted).toBeTruthy()
    const payload = emitted![0][0] as any
    expect(payload.displayName).toBe('MyGroup')
    expect(payload.icon).toBe('AB')
  })
})
