<template>
  <a-card title="未分组表情">
    <template #extra>
      <a-button type="primary" @click="showAddEmojiModal">添加表情</a-button>
    </template>
    <div v-if="items.length === 0" style="text-align: center; padding: 20px;">当前没有未分组表情</div>
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
      <div style="margin-bottom: 16px;">
        <a-input v-model:value="imgBedAuthCode" placeholder="请输入Imgbed Auth Code" style="width: 300px;" />
      </div>
      <a-row :gutter="[16, 16]">
        <a-col v-for="e in items" :key="e.UUID" :xs="24" :sm="12" :md="8" :lg="6" :xl="4">
          <a-card hoverable>
            <template #cover>
              <img
                alt="emoji"
                :src="e.displayUrl || e.realUrl"
                style="width: 100%; height: 150px; object-fit: contain; padding: 10px;"
              />
            </template>
            <a-card-meta :title="e.displayName || '（无名）'">
              <template #description>
                <a-tooltip :title="e.UUID">
                  <span>{{ e.UUID.substring(0, 8) }}...</span>
                </a-tooltip>
              </template>
            </a-card-meta>
            <div style="margin-top: 10px; text-align: right;">
              <a-checkbox v-model:checked="selectedMap[e.UUID]" @change="onCheck(e)" />
              <a-button size="small" style="margin-left: 8px;" @click="moveSingle(e)">移动</a-button>
              <a-button size="small" danger style="margin-left: 8px;" @click="deleteEmoji(e)">删除</a-button>
              <a-button
                v-if="isBase64Image(e.realUrl)"
                size="small"
                style="margin-left: 8px;"
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
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed, reactive } from 'vue'
import store from '../../data/store/main'
import emojiGroupsStore from '../../data/update/emojiGroupsStore'
import { Modal, message } from 'ant-design-vue'
import type { UngroupedEmoji } from '../../data/type/emoji/emoji'
import { useFileUpload } from '../composables/useFileUpload'

// Helper function to detect Base64 image URLs
const isBase64Image = (url: string): boolean => {
  return url.startsWith('data:image/') && url.includes(';base64,')
}

export default defineComponent({
  setup() {
    const items = ref<UngroupedEmoji[]>([])
    const groups = ref<any[]>([])
    const selectedMap: any = ref({})
    const targetGroup = ref<string | null>(null)
    const addEmojiModalVisible = ref(false)
    const uploadingEmojiUUID = ref<string | null>(null) // To track which emoji is being uploaded
    const imgBedAuthCode = ref('') // Global auth code for imgbed

    // ImgBed configuration for useFileUpload composable
    const imgBedConfig = {
      useImgBed: ref(true), // Always use ImgBed for remote uploads
      imgBedEndpoint: ref('https://your.imgbed.domain/'), // Placeholder: User needs to replace this
      imgBedAuthCode: imgBedAuthCode, // Use the local ref for auth code
      imgBedUploadChannel: ref('telegram'),
      imgBedServerCompress: ref(true),
      imgBedAutoRetry: ref(true),
      imgBedUploadNameType: ref('default'),
      imgBedReturnFormat: ref('default'),
      imgBedUploadFolder: ref(''),
    }

    const { remoteUpload } = useFileUpload(imgBedConfig)

    const newEmojiForm = reactive({
      displayName: '',
      realUrl: '',
    })

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

      uploadingEmojiUUID.value = emoji.UUID
      try {
        const base64Data = emoji.realUrl.split(',')[1] || emoji.realUrl;
        const mimeType = emoji.realUrl.split(',')[0].split(':')[1].split(';')[0] || 'image/png';
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Create a File object from the Blob
        const file = new File([blob], `emoji_${emoji.UUID}.${mimeType.split('/')[1]}`, { type: mimeType });

        // Use the remoteUpload function from useFileUpload composable
        const uploadedUrl = await remoteUpload(file);
        
        // Update the emoji's realUrl with the new imgbed URL
        const updatedEmoji = { ...emoji, realUrl: uploadedUrl };
        // Remove the old emoji and add the updated one
        emojiGroupsStore.removeUngroupedByUUID(emoji.UUID);
        emojiGroupsStore.addUngrouped(updatedEmoji);
        message.success('图片上传成功，URL已更新');
        load(); // Reload items to reflect the change
      } catch (error) {
        console.error('上传图片失败:', error);
        message.error(`上传图片失败: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        uploadingEmojiUUID.value = null;
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

    onMounted(load)

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