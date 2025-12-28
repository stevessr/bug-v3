import { ref, type Ref, type ComputedRef } from 'vue'

import {
  CollaborativeUploadClient,
  type UploadProgress as CollabUploadProgress,
  type UploadResult
} from '@/utils/collaborativeUpload'
import type { EmojiGroup } from '@/types/type'
import type { useEmojiStore } from '@/stores/emojiStore'

/**
 * 协作上传 Composable
 * 负责管理 WebSocket 协作上传的完整逻辑
 */

interface FileItem {
  file: File
  width?: number
  height?: number
}

interface UseCollaborativeUploadOptions {
  bufferGroup: ComputedRef<EmojiGroup | undefined>
  emojiStore: ReturnType<typeof useEmojiStore>
  selectedFiles: Ref<FileItem[]>
  isUploading: Ref<boolean>
  clearPersistedFiles: () => Promise<void>
}

export function useCollaborativeUpload(options: UseCollaborativeUploadOptions) {
  const { bufferGroup, emojiStore, selectedFiles, isUploading, clearPersistedFiles } = options

  // --- 状态 ---
  const enableCollaborativeUpload = ref(false)
  const collaborativeServerUrl = ref(
    localStorage.getItem('collaborative-upload-server') || 'ws://localhost:8080'
  )
  const collaborativeClient = ref<CollaborativeUploadClient | null>(null)
  const isCollaborativeConnected = ref(false)
  const collaborativeProgress = ref<CollabUploadProgress | null>(null)
  const collaborativeResults = ref<UploadResult[]>([])
  const disconnectedDuringUpload = ref(false)
  const failedByDisconnect = ref<string[]>([])
  const pendingRemoteUploads = ref<Array<{ filename: string; url: string }>>([])

  // 增量保存定时器
  let incrementalSaveTimer: NodeJS.Timeout | null = null

  // --- 方法 ---

  /**
   * 保存服务器地址到 localStorage
   */
  const saveCollaborativeServerUrl = () => {
    localStorage.setItem('collaborative-upload-server', collaborativeServerUrl.value)
    message.success('服务器地址已保存')
  }

  /**
   * 连接/断开协调服务器
   */
  const connectCollaborativeServer = async () => {
    // 如果已连接，则断开
    if (collaborativeClient.value) {
      collaborativeClient.value.disconnect()
      collaborativeClient.value = null
      isCollaborativeConnected.value = false
      return
    }

    try {
      collaborativeClient.value = new CollaborativeUploadClient({
        serverUrl: collaborativeServerUrl.value,
        role: 'master',
        taskTimeout: 120000, // 2 分钟超时
        onStatusChange: status => {
          isCollaborativeConnected.value = status.connected
          // 如果断线且不在上传中，显示提示
          if (!status.connected && !isUploading.value) {
            message.warning('与协调服务器的连接已断开')
          }
        },
        onProgress: progress => {
          collaborativeProgress.value = progress
        },
        onRemoteUploadComplete: (filename: string, url: string) => {
          // 远程上传完成，添加到待保存列表
          pendingRemoteUploads.value.push({ filename, url })
          console.log(`[useCollaborativeUpload] Remote upload complete: ${filename}, pending save`)
        },
        onDisconnect: pendingTasks => {
          // 上传过程中断线
          console.log('[useCollaborativeUpload] Disconnected during upload, pending tasks:', pendingTasks)
          disconnectedDuringUpload.value = true
          failedByDisconnect.value = pendingTasks
          message.error(`服务器连接断开，${pendingTasks.length} 个远程任务失败`)
        }
      })

      await collaborativeClient.value.connect()
      disconnectedDuringUpload.value = false
      failedByDisconnect.value = []
      message.success('已连接到协调服务器')
    } catch (error) {
      console.error('Failed to connect to collaborative server:', error)
      message.error('连接服务器失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  /**
   * 添加表情到缓冲区
   */
  const addEmojiToBuffer = (filename: string, url: string, skipSave = false) => {
    // 确保缓冲区存在
    let group = bufferGroup.value
    if (!group) {
      emojiStore.createGroup('缓冲区', '📦')
      group = emojiStore.groups.find(g => g.name === '缓冲区')
      if (group) {
        group.id = 'buffer'
      }
    }

    if (!group) return

    // 查找对应的文件信息获取宽高
    const fileItem = selectedFiles.value.find(f => f.file.name === filename)

    const newEmoji = {
      name: filename,
      url: url,
      displayUrl: url,
      packet: 0,
      tags: [] as string[],
      width: fileItem?.width,
      height: fileItem?.height
    }

    emojiStore.addEmojiWithoutSave(group.id || 'buffer', newEmoji)
    // 只在非批量模式下触发保存
    if (!skipSave) {
      emojiStore.maybeSave()
    }

    console.log(`[useCollaborativeUpload] Added emoji to buffer: ${filename}`)
  }

  /**
   * 增量保存：将已完成的远程上传添加到缓冲区并从任务列表移除
   */
  const saveIncrementalProgress = async () => {
    if (pendingRemoteUploads.value.length === 0) return

    console.log(
      `[useCollaborativeUpload] Saving incremental progress: ${pendingRemoteUploads.value.length} files`
    )

    // 使用批量模式添加到缓冲区，避免每个表情都触发保存
    emojiStore.beginBatch()
    try {
      for (const { filename, url } of pendingRemoteUploads.value) {
        const alreadyAdded = bufferGroup.value?.emojis.some(e => e.url === url || e.name === filename)
        if (!alreadyAdded) {
          addEmojiToBuffer(filename, url, true) // skipSave = true
        }
      }
    } finally {
      await emojiStore.endBatch()
    }

    // 从选中文件中移除
    const savedFilenames = new Set(pendingRemoteUploads.value.map(p => p.filename))
    selectedFiles.value = selectedFiles.value.filter(item => !savedFilenames.has(item.file.name))

    // 清空待保存列表
    pendingRemoteUploads.value = []

    console.log('[useCollaborativeUpload] Incremental save completed')
  }

  /**
   * 启动增量保存定时器
   */
  const startIncrementalSaveTimer = () => {
    if (incrementalSaveTimer) return
    incrementalSaveTimer = setInterval(() => {
      saveIncrementalProgress()
    }, 60000) // 每分钟保存一次
    console.log('[useCollaborativeUpload] Incremental save timer started')
  }

  /**
   * 停止增量保存定时器
   */
  const stopIncrementalSaveTimer = () => {
    if (incrementalSaveTimer) {
      clearInterval(incrementalSaveTimer)
      incrementalSaveTimer = null
      console.log('[useCollaborativeUpload] Incremental save timer stopped')
    }
  }

  /**
   * 执行联动上传
   */
  const uploadFilesCollaboratively = async () => {
    if (selectedFiles.value.length === 0) return

    if (!collaborativeClient.value || !isCollaborativeConnected.value) {
      message.error('请先连接到协调服务器')
      return
    }

    // 重置断线状态
    disconnectedDuringUpload.value = false
    failedByDisconnect.value = []
    pendingRemoteUploads.value = [] // 重置待保存列表

    isUploading.value = true
    collaborativeProgress.value = { completed: 0, failed: 0, total: selectedFiles.value.length }
    collaborativeResults.value = []

    // 启动增量保存定时器
    startIncrementalSaveTimer()

    try {
      const files = selectedFiles.value.map(item => item.file)
      const results = await collaborativeClient.value.submitTasks(files)

      // 检查是否被取消
      if (results.some(r => r.error === '用户取消上传')) {
        message.info('联动上传已取消')
        return
      }

      collaborativeResults.value = results

      // 处理远程上传的结果（本地上传已在 onLocalUploadComplete 中处理）
      // 使用批量模式添加到缓冲区，避免竞争条件导致数据回档
      emojiStore.beginBatch()
      try {
        for (const result of results) {
          if (result.success && result.url) {
            // 检查是否已经添加过（本地上传的已添加）
            const alreadyAdded = bufferGroup.value?.emojis.some(
              e => e.url === result.url || e.name === result.filename
            )
            if (!alreadyAdded) {
              addEmojiToBuffer(result.filename, result.url, true) // skipSave = true
            }
          }
        }
      } finally {
        await emojiStore.endBatch()
      }

      // 清理已成功上传的文件，保留失败的文件以便重试
      const successfulFiles = new Set(results.filter(r => r.success).map(r => r.filename))
      selectedFiles.value = selectedFiles.value.filter(item => !successfulFiles.has(item.file.name))

      if (selectedFiles.value.length === 0) {
        await clearPersistedFiles()
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      // 检查是否有因断线失败的任务
      const disconnectErrors = results.filter(
        r => !r.success && (r.error === '服务器连接断开' || r.error === '上传超时')
      )
      if (disconnectErrors.length > 0) {
        message.warning(
          `联动上传完成：${successCount} 成功，${failCount} 失败（${disconnectErrors.length} 个因断线/超时失败，可重试）`
        )
      } else if (failCount > 0) {
        message.warning(`联动上传完成：${successCount} 成功，${failCount} 失败`)
      } else {
        message.success(`联动上传完成：${successCount} 成功`)
      }
    } catch (error) {
      console.error('Collaborative upload failed:', error)
      message.error('联动上传失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      // 停止增量保存定时器
      stopIncrementalSaveTimer()
      // 保存剩余的待保存上传
      await saveIncrementalProgress()
      isUploading.value = false
    }
  }

  /**
   * 取消联动上传
   */
  const cancelCollaborativeUpload = () => {
    if (collaborativeClient.value) {
      collaborativeClient.value.cancelUpload()
      isUploading.value = false
      message.info('正在取消上传...')
    }
  }

  return {
    // State
    enableCollaborativeUpload,
    collaborativeServerUrl,
    collaborativeClient,
    isCollaborativeConnected,
    collaborativeProgress,
    collaborativeResults,
    disconnectedDuringUpload,
    failedByDisconnect,
    pendingRemoteUploads,

    // Methods
    saveCollaborativeServerUrl,
    connectCollaborativeServer,
    uploadFilesCollaboratively,
    cancelCollaborativeUpload,
    saveIncrementalProgress
  }
}
