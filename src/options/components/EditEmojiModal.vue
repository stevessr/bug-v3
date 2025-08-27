<template>
  <a-modal :open="visible" title="编辑表情" @cancel="close" :footer="null">
    <a-form layout="vertical">
      <a-form-item label="图片URL">
        <a-input v-model:value="url" />
      </a-form-item>
      <a-form-item label="图片 & 预览">
        <div style="display: flex; gap: 16px; align-items: flex-start">
          <div style="flex: 1">
            <div style="font-size: 12px; color: rgba(0, 0, 0, 0.85); margin-bottom: 4px">图片</div>
            <div style="display: flex; align-items: center; gap: 8px">
              <img
                v-if="url"
                :src="url"
                style="max-width: 120px; max-height: 80px; border: 1px solid #eee; padding: 4px"
              />
              <div v-else style="color: #888">暂无预览</div>
            </div>
          </div>
          <div style="flex: 1">
            <div style="font-size: 12px; color: rgba(0, 0, 0, 0.85); margin-bottom: 4px">预览</div>
            <div style="display: flex; align-items: center; gap: 8px">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                style="max-width: 120px; max-height: 80px; border: 1px solid #eee; padding: 4px"
              />
              <div v-else style="color: #888">暂无预览</div>
            </div>
          </div>
        </div>
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
      <div style="display: flex; justify-content: space-between; align-items: center">
        <a-popconfirm
          title="确认删除该表情？"
          ok-text="是"
          cancel-text="否"
          @confirm="onConfirmDelete"
          @cancel="onCancelDelete"
        >
          <a-button danger>删除表情</a-button>
        </a-popconfirm>
        <div>
          <a-button @click="close" style="margin-right: 8px">取消</a-button>
          <a-button type="primary" @click="onOk">保存</a-button>
        </div>
      </div>
    </a-form>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
export default defineComponent({
  props: {
    modelValue: { type: Boolean, required: true },
    emoji: { type: Object as any, required: false, default: null },
  },
  emits: ['update:modelValue', 'saved', 'deleted'],
  setup(props, { emit }) {
    const visible = ref(!!props.modelValue)
    const url = ref('')
    const displayName = ref('')
    const generatedId = ref('')
    const previewUrl = ref('')
    const variantsText = ref('')

    watch(
      () => props.modelValue,
      (v) => {
        visible.value = !!v
        if (v && !props.emoji) {
          // Clear fields if modal opens without emoji
          url.value = ''
          previewUrl.value = ''
          displayName.value = ''
          variantsText.value = ''
          generatedId.value = ''
        }
      },
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
      // For editing, we preserve the original UUID/id
      const id =
        (props.emoji && (props.emoji.UUID || props.emoji.id)) ||
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
        order: (props.emoji && props.emoji.order) || 0,
      }
      // emit only saved event for edit flows
      emit('saved', payload)
      close()
    }

    function onDelete() {
      if (props.emoji) {
        emit('deleted', props.emoji)
        close()
      }
    }

    function onConfirmDelete(e: MouseEvent) {
      // emit deleted and show success
      if (props.emoji) {
        emit('deleted', props.emoji)
        message.success('已删除表情')
        close()
      }
    }

    function onCancelDelete(e: MouseEvent) {
      message.error('取消删除')
    }

    return {
      visible,
      url,
      previewUrl,
      displayName,
      onOk,
      onDelete,
      onConfirmDelete,
      onCancelDelete,
      close,
      variantsText,
    }
  },
})
</script>
