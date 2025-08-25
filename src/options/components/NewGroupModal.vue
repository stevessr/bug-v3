<template>
  <a-modal :open="visible" title="新建分组" @ok="onOk" @cancel="close">
    <a-form layout="vertical">
      <a-form-item label="分组名称">
        <a-input v-model:value="name" />
      </a-form-item>
      <a-form-item label="图标 URL">
        <a-input v-model:value="icon" />
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
    const icon = ref('')

    watch(
      () => props.modelValue,
      (v) => (visible.value = !!v),
    )

    function close() {
      emit('update:modelValue', false)
    }

    function onOk() {
      const id =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : String(Date.now())
      emit('created', {
        UUID: id,
        displayName: name.value || 'New Group',
        icon: icon.value || '',
        emojis: [],
        order: 0,
      })
      close()
    }

    return { visible, name, icon, onOk, close }
  },
})
</script>
