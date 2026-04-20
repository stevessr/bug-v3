import { type Ref, type ComputedRef } from 'vue'

import { uploadServices } from '@/utils/uploadServices'
import type { EmojiGroup } from '@/types/type'
import type { useEmojiStore } from '@/stores/emojiStore'

export interface UploadProgressItem {
  id: string
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
      id: item.id,
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

      const findProgressIndex = (id: string) =>
        uploadProgress.value.findIndex(progress => progress.id === id)

      const pruneCompletedUploads = (currentId: string) => {
        const keepIds = new Set(
          uploadProgress.value
            .filter(
              progress => progress.id === currentId || progress.error || progress.percent < 100
            )
            .map(progress => progress.id)
        )

        selectedFiles.value = selectedFiles.value.filter(item => keepIds.has(item.id))

        const progressMap = new Map(uploadProgress.value.map(item => [item.id, item]))
        uploadProgress.value = selectedFiles.value
          .map(item => progressMap.get(item.id))
          .filter(Boolean) as UploadProgressItem[]

        return selectedFiles.value.findIndex(item => item.id === currentId)
      }

      const shouldTerminateUploadFlow = (error: any) =>
        Boolean(
          error?.shouldTerminateUploadFlow ||
          (error?.status === 429 && !(error?.extras && error.extras.wait_seconds))
        )

      const terminateRemainingUploads = (fromIndex: number, reason: string) => {
        for (let idx = fromIndex; idx < uploadProgress.value.length; idx++) {
          if (!uploadProgress.value[idx].error) {
            uploadProgress.value[idx].error = reason
          }
        }
      }

      let i = 0
      while (i < selectedFiles.value.length) {
        const currentItem = selectedFiles.value[i]
        const { file, width, height } = currentItem
        const currentId = currentItem.id
        let currentIndex = i

        try {
          const updateProgress = (percent: number) => {
            const idx = findProgressIndex(currentId)
            if (idx === -1) return
            uploadProgress.value[idx].percent = percent
            if (uploadProgress.value[idx].waitingFor) {
              uploadProgress.value[idx].waitingFor = undefined
              uploadProgress.value[idx].waitStart = undefined
            }
          }

          const onRateLimitWait = async (waitTime: number) => {
            console.log('Rate limit hit. Writing existing batch before waiting.')
            await writeNewEmojis()
            const newIndex = pruneCompletedUploads(currentId)
            if (newIndex !== -1) currentIndex = newIndex
            const idx = findProgressIndex(currentId)
            if (idx === -1) return
            uploadProgress.value[idx].waitingFor = waitTime / 1000
            uploadProgress.value[idx].waitStart = Date.now()
          }

          const uploadResult = service.uploadFileDetailed
            ? await service.uploadFileDetailed(file, updateProgress, onRateLimitWait)
            : {
                url: await service.uploadFile(file, updateProgress, onRateLimitWait)
              }
          const uploadUrl = uploadResult.url

          newEmojis.push({
            name: file.name,
            url: uploadUrl,
            ...(uploadResult.short_url && { short_url: uploadResult.short_url }),
            displayUrl: uploadUrl,
            packet: 0,
            width,
            height
          })
          updateProgress(100)
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          const idx = findProgressIndex(currentId)
          if (idx !== -1) {
            uploadProgress.value[idx].error = error instanceof Error ? error.message : String(error)
          }

          if (shouldTerminateUploadFlow(error)) {
            const reason = '检测到无等待信息的 429，已终止剩余上传以避免继续请求。'
            terminateRemainingUploads(currentIndex + 1, reason)
            message.error(reason)
            break
          }
        }

        i = currentIndex + 1
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
