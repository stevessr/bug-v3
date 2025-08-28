<script setup lang="ts">
/**
 * ImgBedConfig
 * Props: manager?: ReturnType<typeof useImgBed>
 *
 * This component directly reads/writes the provided `imgBedManager` (from `useImgBed()`).
 * Pass the composable instance (imgBedManager) from the parent to share state.
 */
import { computed } from 'vue'
import type { PropType } from 'vue'

import { useImgBed } from '../composables/useImgBed'
import type { ImgBedUploadChannel } from '../types'

const props = defineProps<{
  manager?: ReturnType<typeof useImgBed>
}>()

// If no manager provided, fallback to a local instance (safer for isolated usage)
const manager = props.manager ?? useImgBed()

const open = computed({
  get: () => manager.showImgBedModal.value,
  set: (v: boolean) => (manager.showImgBedModal.value = v),
})

const endpoint = computed({
  get: () => manager.imgBedEndpoint.value,
  set: (v: string) => (manager.imgBedEndpoint.value = v),
})

const authCode = computed({
  get: () => manager.imgBedAuthCode.value,
  set: (v: string) => (manager.imgBedAuthCode.value = v),
})

const uploadFolder = computed({
  get: () => manager.imgBedUploadFolder.value,
  set: (v: string) => (manager.imgBedUploadFolder.value = v),
})

const uploadChannel = computed<ImgBedUploadChannel>({
  get: () => manager.imgBedUploadChannel.value,
  // cast to typed union
  set: (v: any) => (manager.imgBedUploadChannel.value = v as ImgBedUploadChannel),
})

const serverCompress = computed({
  get: () => manager.imgBedServerCompress.value,
  set: (v: boolean) => (manager.imgBedServerCompress.value = v),
})

const autoRetry = computed({
  get: () => manager.imgBedAutoRetry.value,
  set: (v: boolean) => (manager.imgBedAutoRetry.value = v),
})

const onSave = () => {
  // use composable's save (which also closes modal and shows message)
  manager.saveImgBedConfig()
}

const onClose = () => {
  manager.closeImgBedModal()
}
</script>

<template>
  <a-modal v-model:open="open" title="ImgBed 配置" @ok="onSave" @cancel="onClose" width="640px">
    <span style="margin-left: 4px">
      请先在
      <a href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank"
        >Cloudflare-ImgBed</a
      >
      项目中部署 ImgBed 服务
      <br />
      &nbsp然后填写 ImgBed 的 endpoint 和 authCode（可选）。
    </span>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px">
      <a-input
        v-model:value="endpoint"
        placeholder="ImgBed endpoint (例如 https://your.domain/upload)"
      />
      <a-input v-model:value="authCode" placeholder="authCode (可选)" />
      <a-input v-model:value="uploadFolder" placeholder="上传目录 (例如 img/test)" />
      <a-select v-model:value="uploadChannel" style="width: 200px">
        <a-select-option value="telegram">telegram</a-select-option>
        <a-select-option value="cfr2">cfr2</a-select-option>
        <a-select-option value="s3">s3</a-select-option>
      </a-select>
      <a-checkbox v-model:checked="serverCompress">启用服务器压缩</a-checkbox>
      <a-checkbox v-model:checked="autoRetry">失败自动重试</a-checkbox>
    </div>
  </a-modal>
</template>

<style scoped>
/* small spacing adjustments can be added here if needed */
</style>
