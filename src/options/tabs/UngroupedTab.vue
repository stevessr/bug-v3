<template>
  <a-card title="未分组表情">
    <template #extra>
      <a-button type="primary" @click="showAddEmojiModal">添加表情</a-button>
    </template>
    <div v-if="items.length === 0" style="text-align: center; padding: 20px">
      当前没有未分组表情
    </div>
    <div v-else>
      <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
        <a-select v-model:value="targetGroup" style="min-width: 220px" placeholder="选择目标分组">
          <a-select-option v-for="g in groups" :key="g.UUID" :value="g.UUID"
            >{{ g.displayName }} ({{ g.UUID }})</a-select-option
          >
        </a-select>
        <a-button
          type="primary"
          :disabled="!targetGroup || selected.length === 0"
          @click="moveSelected"
          >移动到分组</a-button
        >
        <a-button @click="selectAll">全选</a-button>
        <a-button @click="clearSelection">清空</a-button>
      </div>
      <a-row :gutter="[16, 16]">
        <a-col v-for="e in items" :key="e.UUID" :xs="24" :sm="12" :md="8" :lg="6" :xl="4">
          <a-card hoverable>
            <template #cover>
              <img
                alt="emoji"
                :src="toSrc(e.displayUrl || e.realUrl)"
                style="
                  width: 100%;
                  height: 150px;
                  object-fit: contain;
                  padding: 10px;
                  cursor: pointer;
                "
                @click="openPreview(e)"
              />
            </template>
            <a-card-meta :title="e.displayName || '（无名）'">
              <template #description>
                <a-tooltip :title="e.UUID">
                  <span>{{ e.UUID.substring(0, 8) }}...</span>
                </a-tooltip>
              </template>
            </a-card-meta>
            <div style="margin-top: 10px; text-align: right">
              <a-checkbox v-model:checked="selectedMap[e.UUID]" @change="onCheck(e)" />
              <a-button size="small" style="margin-left: 8px" @click="moveSingle(e)">移动</a-button>
              <a-button size="small" danger style="margin-left: 8px" @click="deleteEmoji(e)"
                >删除</a-button
              >
              <a-button
                v-if="isBase64Image(e.realUrl)"
                size="small"
                style="margin-left: 8px"
                :loading="uploadingEmojiUUID === e.UUID"
                :disabled="!imgBedAuthCode"
                @click="uploadEmojiImageToImgbed(e)"
              >
                {{ uploadingEmojiUUID === e.UUID ? '上传中...' : '上传到Imgbed' }}
              </a-button>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <a-modal
      title="添加新表情"
      v-model:open="addEmojiModalVisible"
      @ok="handleAddEmoji"
      @cancel="cancelAddEmoji"
    >
      <a-form :model="newEmojiForm" layout="vertical">
        <a-form-item label="表情名称" name="displayName">
          <a-input v-model:value="newEmojiForm.displayName" />
        </a-form-item>
        <a-form-item label="图片URL" name="realUrl">
          <a-input v-model:value="newEmojiForm.realUrl" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
  <a-modal
    v-model:open="previewVisible"
    title="表情预览"
    @cancel="closePreview"
    ok-text="删除"
    @ok="confirmDeletePreview"
  >
    <div style="text-align: center">
      <img
        v-if="previewEmoji"
        :src="toSrc(previewEmoji.displayUrl || previewEmoji.realUrl)"
        style="max-width: 100%; max-height: 60vh; object-fit: contain"
      />
      <div style="margin-top: 8px">{{ previewEmoji?.displayName || '（无名）' }}</div>
    </div>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed, reactive } from 'vue'
import store from '../../data/store/main'
import emojiGroupsStore from '../../data/update/emojiGroupsStore'
import { Modal, message } from 'ant-design-vue'
import type { UngroupedEmoji } from '../../data/type/emoji/emoji'
import { useFileUpload } from '../composables/useFileUpload'
import { useImgBed } from '../composables/useImgBed'

// Helper function to detect Base64 image URLs
const isBase64Image = (url: string | URL | null | undefined): boolean => {
  if (!url) return false
  // 如果是字符串则直接使用，否则尝试调用 toString()（URL 对象有 toString）
  const s =
    typeof url === 'string'
      ? url
      : typeof (url as URL).toString === 'function'
        ? (url as URL).toString()
        : String(url)
  return s.startsWith('data:image/') || s.includes(';base64,')
}

export default defineComponent({
  setup() {
    const items = ref<UngroupedEmoji[]>([])
    const groups = ref<any[]>([])
    const selectedMap: any = ref({})
    const targetGroup = ref<string | null>(null)
    const addEmojiModalVisible = ref(false)
    const uploadingEmojiUUID = ref<string | null>(null) // To track which emoji is being uploaded

    // Use file upload composable which internally reads ImgBed config
    const { remoteUpload } = useFileUpload()

    // Expose imgbed auth code to the template so the user can input it
    const imgBed = useImgBed()
    const imgBedAuthCode = imgBed.imgBedAuthCode

    const newEmojiForm = reactive({
      displayName: '',
      realUrl: '',
    })

    // Preview modal state
    const previewVisible = ref(false)
    const previewEmoji = ref<UngroupedEmoji | null>(null)

    function openPreview(e: UngroupedEmoji) {
      previewEmoji.value = e
      previewVisible.value = true
    }

    function closePreview() {
      previewVisible.value = false
      previewEmoji.value = null
    }

    function confirmDeletePreview() {
      if (!previewEmoji.value) return
      const uuid = previewEmoji.value.UUID
      const success = emojiGroupsStore.removeUngroupedByUUID(uuid)
      if (success) {
        message.success('表情已删除')
        closePreview()
        load()
      } else {
        message.error('删除失败')
      }
    }

    const toSrc = (v: any): string => {
      if (!v) return ''
      return typeof v === 'string' ? v : typeof v.toString === 'function' ? v.toString() : String(v)
    }

    const selected = computed(() =>
      Object.keys(selectedMap.value).filter((k) => selectedMap.value[k]),
    )

    function load() {
      items.value = store.getUngrouped()
      groups.value = store.getGroups()
    }

    function selectAll() {
      items.value.forEach((i: any) => (selectedMap.value[i.UUID] = true))
    }

    function clearSelection() {
      selectedMap.value = {}
    }

    function onCheck(e: any) {
      selectedMap.value = { ...selectedMap.value }
    }

    function moveSelected() {
      const uuids = selected.value
      if (!uuids.length || !targetGroup.value) return
      const res = store.moveUngroupedToGroup(uuids, targetGroup.value)
      try {
        Modal.info({ title: '移动完成', content: `已移动 ${res.moved || 0} 项到分组。` })
      } catch (_) {}
      clearSelection()
      load()
    }

    function moveSingle(e: UngroupedEmoji) {
      if (!targetGroup.value) {
        try {
          Modal.info({ title: '请选择目标分组', content: '请先在顶部选择一个目标分组。' })
        } catch (_) {}
        return
      }
      const res = store.moveUngroupedToGroup([e.UUID], targetGroup.value)
      try {
        Modal.info({ title: '移动完成', content: `已移动 ${res.moved || 0} 项到分组。` })
      } catch (_) {}
      load()
    }

    function deleteEmoji(e: UngroupedEmoji) {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除表情 "${e.displayName || '（无名）'}" 吗？`,
        onOk() {
          const success = emojiGroupsStore.removeUngroupedByUUID(e.UUID)
          if (success) {
            message.success('表情删除成功')
            load()
          } else {
            message.error('表情删除失败')
          }
        },
      })
    }

    function showAddEmojiModal() {
      addEmojiModalVisible.value = true
      newEmojiForm.displayName = ''
      newEmojiForm.realUrl = ''
    }

    function cancelAddEmoji() {
      addEmojiModalVisible.value = false
    }

    async function uploadEmojiImageToImgbed(emoji: UngroupedEmoji) {
      if (!imgBedAuthCode.value) {
        message.error('请先设置Imgbed Auth Code')
        return
      }

      if (!isBase64Image(String(emoji.realUrl))) {
        message.error('当前图片不是 Base64 数据，无法直接上传')
        return
      }

      uploadingEmojiUUID.value = emoji.UUID
      try {
        // Convert data URL to File via fetch -> blob for maximum compatibility
        const res = await fetch(emoji.realUrl)
        const blob = await res.blob()
        const mimeType = blob.type || 'image/png'
        const file = new File([blob], `emoji_${emoji.UUID}.${mimeType.split('/')[1]}`, {
          type: mimeType,
        })

        // Delegate actual upload to composable's remoteUpload
        const uploadedUrl = await remoteUpload(file)

        const updatedEmoji = { ...emoji, realUrl: uploadedUrl, displayUrl: uploadedUrl }
        emojiGroupsStore.removeUngroupedByUUID(emoji.UUID)
        emojiGroupsStore.addUngrouped(updatedEmoji)
        message.success('图片上传成功，URL已更新')
        load()
      } catch (error) {
        console.error('上传图片失败:', error)
        message.error(`上传图片失败: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        uploadingEmojiUUID.value = null
      }
    }

    function handleAddEmoji() {
      if (!newEmojiForm.displayName) {
        message.error('表情名称不能为空')
        return
      }
      if (!newEmojiForm.realUrl) {
        message.error('图片URL不能为空')
        return
      }

      const newEmoji: UngroupedEmoji = {
        id: crypto.randomUUID(),
        displayName: newEmojiForm.displayName,
        realUrl: newEmojiForm.realUrl as any,
        displayUrl: newEmojiForm.realUrl as any,
        order: items.value.length,
        UUID: crypto.randomUUID(),
        addedAt: Date.now(),
      }

      emojiGroupsStore.addUngrouped(newEmoji)
      message.success('表情添加成功')
      addEmojiModalVisible.value = false
      load()
    }

    onMounted(() => {
      load()
    })

    return {
      items,
      groups,
      selectedMap,
      targetGroup,
      selected,
      selectAll,
      clearSelection,
      onCheck,
      moveSelected,
      moveSingle,
      deleteEmoji,
      addEmojiModalVisible,
      newEmojiForm,
      showAddEmojiModal,
      cancelAddEmoji,
      handleAddEmoji,
      uploadingEmojiUUID,
      uploadEmojiImageToImgbed,
      isBase64Image,
      imgBedAuthCode,
      toSrc,
      previewVisible,
      previewEmoji,
      openPreview,
      closePreview,
      confirmDeletePreview,
    }
  },
})
</script>

<style scoped>
/* Add any specific styles for your cards here */
.ant-card-cover img {
  object-fit: contain;
}
</style>
