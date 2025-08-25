<template>
  <a-modal :open="visible" title="新建分组" @ok="onOk" @cancel="close">
    <a-form layout="vertical">
      <a-form-item label="分组名称">
        <a-input v-model:value="name" />
      </a-form-item>

      <a-form-item label="图标 (文字 或 URL)">
        <a-radio-group v-model:value="mode">
          <a-radio value="auto">自动</a-radio>
          <a-radio value="text">文字</a-radio>
          <a-radio value="url">URL</a-radio>
        </a-radio-group>
        <div style="font-size: 12px; color: var(--ant-text-color-secondary); margin-top: 8px">
          {{ hint }}
        </div>
        <a-input
          v-model:value="iconInput"
          placeholder="输入图标文字或图片 URL"
          style="margin-top: 8px"
        />
        <div style="margin-top: 8px; display: flex; gap: 8px; align-items: flex-start">
          <template v-if="isUrlPreview">
            <div
              style="
                width: 56px;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--ant-border-color);
                border-radius: 6px;
              "
            >
              <img
                :src="iconPreview"
                style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px"
              />
            </div>
          </template>
          <template v-else>
            <div
              style="
                padding: 6px 10px;
                border: 1px solid var(--ant-border-color);
                border-radius: 6px;
                font-size: 18px;
                font-weight: 600;
                white-space: normal;
                word-break: break-word;
              "
            >
              {{ iconPreview || 'A' }}
            </div>
          </template>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'

export default defineComponent({
  props: {
    modelValue: { type: Boolean, required: true },
  },
  emits: ['update:modelValue', 'created'],
  setup(props, { emit }) {
    const visible = ref(!!props.modelValue)
    const name = ref('New Group')
    const mode = ref<'auto' | 'text' | 'url'>('auto')
    const iconInput = ref('')
    const iconPreview = ref('')
    const isUrlPreview = ref(false)
    const hint = ref('可输入单字符文字或图片 URL，自动检测 URL')

    watch(
      () => props.modelValue,
      (v) => (visible.value = !!v),
    )

    function close() {
      emit('update:modelValue', false)
    }

    function isLikelyUrl(s: string) {
      if (!s) return false
      return /^https?:\/\//i.test(s) || s.startsWith('//')
    }

    watch(
      [iconInput, mode],
      () => {
        const val = (iconInput.value || '').trim()
        if (!val) {
          iconPreview.value = ''
          isUrlPreview.value = false
          hint.value = '可输入单字符文字或图片 URL，自动检测 URL'
          return
        }
        if (mode.value === 'url') {
          isUrlPreview.value = true
          iconPreview.value = val
          hint.value = '以 URL 形式使用图标'
          return
        }
        if (mode.value === 'text') {
          isUrlPreview.value = false
          iconPreview.value = val
          hint.value = '以文本形式使用图标'
          return
        }
        // auto
        if (isLikelyUrl(val)) {
          isUrlPreview.value = true
          iconPreview.value = val
          hint.value = '检测到 URL，自动使用图片预览'
        } else {
          isUrlPreview.value = false
          iconPreview.value = val
          hint.value = '检测到文字，使用文字作为图标'
        }
      },
      { immediate: true },
    )

    function onOk() {
      const id =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : String(Date.now())
      let finalIcon = iconInput.value || ''
      if (mode.value === 'auto') {
        finalIcon = isLikelyUrl(iconInput.value) ? iconInput.value : iconInput.value
      }
      emit('created', {
        UUID: id,
        displayName: name.value || 'New Group',
        icon: finalIcon,
        emojis: [],
        order: 0,
      })
      close()
    }

    return { visible, name, mode, iconInput, iconPreview, isUrlPreview, hint, onOk, close }
  },
})
</script>
