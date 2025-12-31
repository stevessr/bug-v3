import { type Ref, type ComputedRef } from 'vue'
import { message } from 'ant-design-vue'

import { uploadServices } from '@/utils/uploadServices'
import type { EmojiGroup } from '@/types/type'
import type { useEmojiStore } from '@/stores/emojiStore'

export interface UploadProgressItem {
  fileName: string
  percent: number
  error?: string
  waitingFor?: number
  waitStart?: number
}

interface UseUploadOptions {
  selectedFiles: Ref<any[]>
  isUploading: Ref<boolean>
  uploadProgress: Ref<UploadProgressItem[]>
  bufferGroup: ComputedRef<EmojiGroup | undefined>
  emojiStore: ReturnType<typeof useEmojiStore>
  uploadService: Ref<'linux.do' | 'idcflare.com' | 'imgbed'>
  clearPersistedFiles: () => Promise<void>
}

export function useUpload(options: UseUploadOptions) {
  const {
    selectedFiles,
    isUploading,
    uploadProgress,
    bufferGroup,
    emojiStore,
    uploadService,
    clearPersistedFiles
  } = options

  const uploadFiles = async () => {
    if (selectedFiles.value.length === 0) return

    isUploading.value = true
    uploadProgress.value = selectedFiles.value.map(item => ({
      fileName: item.file.name,
      percent: 0
    }))

    // Ensure buffer group exists
    let group = bufferGroup.value
    if (!group) {
      group = emojiStore.createGroup('缓冲区', '📦')
      const buffer = emojiStore.groups.find(g => g.name === '缓冲区')
      if (buffer) {
        buffer.id = 'buffer'
        group = buffer
      }
    }

    if (!group) {
      console.error('Failed to create buffer group')
      isUploading.value = false
      return
    }

    const newEmojis: any[] = []
    const groupId = group.id || 'buffer'
    const writeNewEmojis = async () => {
      if (newEmojis.length === 0) return
      console.log(`Writing batch of ${newEmojis.length} emojis.`)
      emojiStore.beginBatch()
      try {
        for (const newEmoji of newEmojis) {
          emojiStore.addEmojiWithoutSave(groupId, newEmoji)
        }
      } finally {
        await emojiStore.endBatch()
        newEmojis.length = 0 // Clear the array after writing
      }
    }

    try {
      const service = uploadServices[uploadService.value]

      for (let i = 0; i < selectedFiles.value.length; i++) {
        const { file, width, height } = selectedFiles.value[i]

        try {
          const updateProgress = (percent: number) => {
            uploadProgress.value[i].percent = percent
            if (uploadProgress.value[i].waitingFor) {
              uploadProgress.value[i].waitingFor = undefined
              uploadProgress.value[i].waitStart = undefined
            }
          }

          const onRateLimitWait = async (waitTime: number) => {
            console.log('Rate limit hit. Writing existing batch before waiting.')
            await writeNewEmojis()
            uploadProgress.value[i].waitingFor = waitTime / 1000
            uploadProgress.value[i].waitStart = Date.now()
          }

          const uploadUrl = await service.uploadFile(file, updateProgress, onRateLimitWait)

          newEmojis.push({
            name: file.name,
            url: uploadUrl,
            displayUrl: uploadUrl,
            packet: 0,
            width,
            height
          })
          uploadProgress.value[i].percent = 100
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          uploadProgress.value[i].error = error instanceof Error ? error.message : String(error)
        }
      }

      // After the loop, write any remaining emojis.
      await writeNewEmojis()

      // Count successes and failures
      const successCount = uploadProgress.value.filter(p => !p.error).length
      const failCount = uploadProgress.value.filter(p => p.error).length

      // Show notification
      if (failCount > 0 && successCount > 0) {
        message.warning(`上传完成：${successCount} 成功，${failCount} 失败`)
      } else if (failCount > 0) {
        message.error(`上传失败：${failCount} 个文件上传失败`)
      } else if (successCount > 0) {
        message.success(`上传完成：${successCount} 个文件`)
      }

      // Keep failed files in the list for retry
      selectedFiles.value = selectedFiles.value.filter((_, i) => uploadProgress.value[i].error)

      // 如果所有文件都上传成功，清除持久化数据
      if (selectedFiles.value.length === 0) {
        await clearPersistedFiles()
      }

      setTimeout(() => {
        uploadProgress.value = []
      }, 3000)
    } finally {
      isUploading.value = false
    }
  }

  return {
    uploadFiles
  }
}
