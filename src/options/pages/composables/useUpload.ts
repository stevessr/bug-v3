import { type Ref, type ComputedRef } from 'vue'

import { uploadServices } from '@/utils/uploadServices'
import type { EmojiGroup } from '@/types/type'
import type { useEmojiStore } from '@/stores/emojiStore'

export interface UploadProgressItem {
  id: string
  fileName: string
  previewUrl?: string
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
  uploadConcurrency?: Ref<number | null | undefined>
  clearPersistedFiles: () => Promise<void>
}

const DEFAULT_UPLOAD_CONCURRENCY = 5
const MAX_UPLOAD_CONCURRENCY = 20
export function useUpload(options: UseUploadOptions) {
  const {
    selectedFiles,
    isUploading,
    uploadProgress,
    bufferGroup,
    emojiStore,
    uploadService,
    uploadConcurrency,
    clearPersistedFiles
  } = options

  const getUploadConcurrency = () => {
    const value = Number(uploadConcurrency?.value ?? DEFAULT_UPLOAD_CONCURRENCY)
    if (!Number.isFinite(value)) return DEFAULT_UPLOAD_CONCURRENCY
    return Math.min(MAX_UPLOAD_CONCURRENCY, Math.max(1, Math.floor(value)))
  }

  const uploadFiles = async () => {
    const filesSnapshot = selectedFiles.value.slice()
    if (filesSnapshot.length === 0) return

    isUploading.value = true
    uploadProgress.value = filesSnapshot.map(item => ({
      id: item.id,
      fileName: item.file.name,
      previewUrl: item.previewUrl,
      percent: 0
    }))

    const ensureBufferGroup = (): EmojiGroup | undefined => {
      let group = bufferGroup.value
      if (!group) {
        group = emojiStore.createGroup('缓冲区', '📦', 'buffer')
      }
      return group
    }

    // A folder import carries targetGroupId on each file. Resolve the target
    // once at upload start so mixed queues (ordinary files + multiple folders)
    // are appended to their own groups instead of all landing in the buffer.
    const destinationGroups = new Map<string, EmojiGroup>()
    const getDestinationGroup = (item: any): EmojiGroup | undefined => {
      const requestedId = item?.targetGroupId
      if (typeof requestedId === 'string' && requestedId) {
        const requestedGroup = emojiStore.groups.find(group => group.id === requestedId)
        if (requestedGroup) return requestedGroup
        console.warn(
          `[BufferPage] Destination group ${requestedId} no longer exists; falling back to buffer`
        )
      }
      return ensureBufferGroup()
    }

    for (const item of filesSnapshot) {
      const group = getDestinationGroup(item)
      if (group) destinationGroups.set(item.id, group)
    }

    if (destinationGroups.size !== filesSnapshot.length) {
      console.error('Failed to resolve one or more upload destination groups')
      isUploading.value = false
      return
    }

    const newEmojis: Array<{ id: string; index: number; groupId: string; emoji: any }> = []
    const flushedUploadIds = new Set<string>()
    const successfulUploadIds = new Set<string>()
    let writeNewEmojisQueue = Promise.resolve()

    const writeNewEmojisBatch = async (): Promise<string[]> => {
      if (newEmojis.length === 0) return []
      const batch = newEmojis.splice(0).sort((a, b) => a.index - b.index)
      console.log(`Writing batch of ${batch.length} emojis.`)
      const flushedIds: string[] = []
      emojiStore.beginBatch()
      try {
        for (const { id, groupId, emoji } of batch) {
          if (emojiStore.addEmojiWithoutSave(groupId, emoji)) {
            flushedIds.push(id)
          }
        }
      } finally {
        await emojiStore.endBatch()
      }
      return flushedIds
    }

    const writeNewEmojis = async () => {
      const writeTask = writeNewEmojisQueue.then(writeNewEmojisBatch)
      writeNewEmojisQueue = writeTask.then(
        () => undefined,
        () => undefined
      )
      return writeTask
    }

    const removeFlushedUploadsFromPendingList = () => {
      if (flushedUploadIds.size === 0 || selectedFiles.value.length === 0) return

      const beforeCount = selectedFiles.value.length
      selectedFiles.value = selectedFiles.value.filter(item => !flushedUploadIds.has(item.id))
      const removedCount = beforeCount - selectedFiles.value.length

      if (removedCount > 0) {
        console.log(
          `[BufferPage] Removed ${removedCount} completed uploads from the pending upload list.`
        )
      }
    }

    const flushCompletedUploadsToPendingList = async () => {
      const flushedIds = await writeNewEmojis()
      for (const id of flushedIds) {
        flushedUploadIds.add(id)
      }
      removeFlushedUploadsFromPendingList()
    }

    try {
      const service = uploadServices[uploadService.value]
      if (!service) {
        throw new Error(`Unknown upload service: ${uploadService.value}`)
      }

      const findProgressIndex = (id: string) =>
        uploadProgress.value.findIndex(progress => progress.id === id)

      const shouldTerminateUploadFlow = (error: any) =>
        Boolean(
          error?.shouldTerminateUploadFlow ||
          (error?.status === 429 && !(error?.extras && error.extras.wait_seconds))
        )

      let rateLimitUntil = 0
      let terminalReason = ''
      let nextUploadIndex = 0

      const clearWaitingState = (progress: UploadProgressItem) => {
        progress.waitingFor = undefined
        progress.waitStart = undefined
      }

      const clearGlobalRateLimitWait = () => {
        if (Date.now() < rateLimitUntil) return
        for (const progress of uploadProgress.value) {
          if (progress.waitingFor) {
            clearWaitingState(progress)
          }
        }
        uploadProgress.value = [...uploadProgress.value]
      }

      const enterGlobalRateLimitWait = async (waitTime: number) => {
        const now = Date.now()
        rateLimitUntil = Math.max(rateLimitUntil, now + waitTime)

        // ① 第一时间将已上传成功的文件写入各自的目标分组
        await flushCompletedUploadsToPendingList()

        // ② 从 uploadProgress 中移除已写入缓冲区的项
        if (flushedUploadIds.size > 0) {
          uploadProgress.value = uploadProgress.value.filter(p => !flushedUploadIds.has(p.id))
        }

        // ③ 对剩余未完成项设置等待状态，统一触发一次 re-render
        const waitingFor = Math.max(1, Math.ceil((rateLimitUntil - now) / 1000))
        for (const progress of uploadProgress.value) {
          if (!progress.error && progress.percent < 100) {
            progress.waitingFor = waitingFor
            progress.waitStart = now
          }
        }
        uploadProgress.value = [...uploadProgress.value]
      }

      const waitForGlobalRateLimit = async () => {
        while (!terminalReason) {
          const remaining = rateLimitUntil - Date.now()
          if (remaining <= 0) {
            clearGlobalRateLimitWait()
            return
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 1000)))
        }
      }

      const markRemainingUploadsTerminated = (reason: string) => {
        for (const progress of uploadProgress.value) {
          if (!progress.error && progress.percent < 100) {
            progress.error = reason
            clearWaitingState(progress)
          }
        }
        uploadProgress.value = [...uploadProgress.value]
      }

      const getNextUploadIndex = () => {
        if (terminalReason) return null
        if (nextUploadIndex >= filesSnapshot.length) return null
        const index = nextUploadIndex
        nextUploadIndex++
        return index
      }

      const uploadOne = async (fileIndex: number) => {
        const currentItem = filesSnapshot[fileIndex]
        if (!currentItem) return

        const { file, width, height } = currentItem
        const currentId = currentItem.id
        const destinationGroup = destinationGroups.get(currentId)

        try {
          if (!destinationGroup) {
            throw new Error('未找到上传目标分组')
          }

          const updateProgress = (percent: number) => {
            const idx = findProgressIndex(currentId)
            if (idx === -1) return
            uploadProgress.value[idx].percent = percent
            if (
              uploadProgress.value[idx].waitingFor &&
              (percent >= 100 || Date.now() >= rateLimitUntil)
            ) {
              clearWaitingState(uploadProgress.value[idx])
            }
          }

          const onRateLimitWait = async (waitTime: number) => {
            console.log(
              `[BufferPage] Rate limit hit by ${file.name}. Pausing all upload coroutines for ${
                waitTime / 1000
              }s.`
            )
            await enterGlobalRateLimitWait(waitTime)
          }

          const uploadResult = service.uploadFileDetailed
            ? await service.uploadFileDetailed(file, updateProgress, onRateLimitWait)
            : {
                url: await service.uploadFile(file, updateProgress, onRateLimitWait)
              }
          const uploadUrl = uploadResult.url

          newEmojis.push({
            id: currentId,
            index: fileIndex,
            groupId: destinationGroup.id,
            emoji: {
              name: file.name,
              url: uploadUrl,
              ...(uploadResult.short_url && { short_url: uploadResult.short_url }),
              displayUrl: uploadUrl,
              packet: 0,
              width,
              height
            }
          })
          successfulUploadIds.add(currentId)
          updateProgress(100)

          if (Date.now() < rateLimitUntil) {
            await flushCompletedUploadsToPendingList()
            // 清理已完成项的进度卡片
            if (flushedUploadIds.size > 0) {
              uploadProgress.value = uploadProgress.value.filter(p => !flushedUploadIds.has(p.id))
            }
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          const idx = findProgressIndex(currentId)
          if (idx !== -1) {
            uploadProgress.value[idx].error = error instanceof Error ? error.message : String(error)
          }

          const exhaustedRateLimitWait = Number((error as any)?.waitTime)
          if ((error as any)?.isRateLimitError && exhaustedRateLimitWait > 0) {
            await enterGlobalRateLimitWait(exhaustedRateLimitWait)
          }

          if (shouldTerminateUploadFlow(error)) {
            terminalReason = '检测到无等待信息的 429，已终止剩余上传以避免继续请求。'
            message.error(terminalReason)
          }
        }
      }

      const workerCount = Math.min(getUploadConcurrency(), filesSnapshot.length)
      const runUploadWorker = async () => {
        while (true) {
          await waitForGlobalRateLimit()
          const uploadIndex = getNextUploadIndex()
          if (uploadIndex === null) return
          await uploadOne(uploadIndex)
        }
      }

      await Promise.all(Array.from({ length: workerCount }, () => runUploadWorker()))

      if (terminalReason) {
        markRemainingUploadsTerminated(terminalReason)
      }

      // After the loop, write any remaining emojis and clear completed files from pending list.
      await flushCompletedUploadsToPendingList()

      // Count successes and failures
      const successCount = successfulUploadIds.size
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
      const failedIds = new Set(uploadProgress.value.filter(p => p.error).map(p => p.id))
      selectedFiles.value = selectedFiles.value.filter(item => failedIds.has(item.id))

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
