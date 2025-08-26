<template>
  <a-modal :open="visible" title="添加表情" @ok="onOk" @cancel="close">
    <a-form layout="vertical">
      <a-form-item label="图片URL">
        <a-input v-model:value="url" />
      </a-form-item>
      <a-form-item label="预览 URL (可选)">
        <a-input
          v-model:value="previewUrl"
          placeholder="用于列表/缩略图的预览地址，若为空使用图片URL"
        />
      </a-form-item>
      <a-form-item label="显示名称">
        <a-input v-model:value="displayName" />
      </a-form-item>
      <a-form-item label="变种 (JSON，可选)">
        <a-textarea
          v-model:value="variantsText"
          placeholder='例如: {"1x":"https://...","2x":"https://..."}'
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
export default defineComponent({
  props: {
    modelValue: { type: Boolean, required: true },
    emoji: { type: Object as any, required: false },
  },
  emits: ['update:modelValue', 'added', 'saved'],
  setup(props, { emit }) {
    const visible = ref(!!props.modelValue)
    const url = ref('')
    const displayName = ref('')
    const generatedId = ref('')
    const previewUrl = ref('')
    const variantsText = ref('')

    watch(
      () => props.modelValue,
      (v) => (visible.value = !!v),
    )

    function close() {
      emit('update:modelValue', false)
    }

    // simple deterministic hash to produce id from URL
    function urlToId(u: string) {
      if (!u) return String(Date.now())
      let h = 2166136261 >>> 0
      for (let i = 0; i < u.length; i++) {
        h ^= u.charCodeAt(i)
        h = Math.imul(h, 16777619) >>> 0
      }
      return 'u' + h.toString(16)
    }

    watch(url, (v) => {
      generatedId.value = urlToId(v || '')
    })

    // if emoji prop provided, prefill fields for edit
    watch(
      () => props.emoji,
      (val) => {
        if (val) {
          url.value = val.realUrl || ''
          previewUrl.value = val.displayUrl || ''
          displayName.value = val.displayName || ''
          generatedId.value = val.UUID || val.id || generatedId.value
          variantsText.value = val.variants ? JSON.stringify(val.variants) : ''
        }
      },
      { immediate: true },
    )

    function onOk() {
      const id =
        generatedId.value ||
        (typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : String(Date.now()))
      const payload = {
        UUID: id,
        id: id,
        displayName: displayName.value || '',
        displayUrl: previewUrl.value || url.value,
        realUrl: url.value,
        variants: (() => {
          try {
            return variantsText.value ? JSON.parse(variantsText.value) : {}
          } catch (_) {
            return {}
          }
        })(),
        order: 0,
      }
      // emit both saved (for edit flows) and added (for compatibility)
      emit('saved', payload)
      emit('added', payload)
      close()
    }

    return { visible, url, previewUrl, displayName, onOk, close, variantsText }
  },
})
</script>
