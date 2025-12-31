import { CollaborativeUploadClient } from './CollaborativeUploadClient'
import type { ConnectionStatus, UploadProgress, WorkerStats, UploadResult } from './types'

export * from './types'
export * from './constants'
export * from './CollaborativeUploadClient'

// ==================== 便捷函数 ====================

let workerClient: CollaborativeUploadClient | null = null

/**
 * 启动工作者模式
 */
export async function startWorkerMode(
  serverUrl: string,
  onStatusChange?: (status: ConnectionStatus) => void,
  onWorkerStats?: (stats: WorkerStats) => void,
  onCurrentTask?: (task: { filename: string; status: string } | null) => void
): Promise<CollaborativeUploadClient> {
  if (workerClient) {
    workerClient.disconnect()
  }

  workerClient = new CollaborativeUploadClient({
    serverUrl,
    role: 'worker',
    onStatusChange,
    onWorkerStats,
    onCurrentTask
  })

  await workerClient.connect()
  return workerClient
}

/**
 * 停止工作者模式
 */
export function stopWorkerMode(): void {
  if (workerClient) {
    workerClient.disconnect()
    workerClient = null
  }
}

/**
 * 获取当前工作者客户端
 */
export function getWorkerClient(): CollaborativeUploadClient | null {
  return workerClient
}

/**
 * 创建主控端并上传文件
 */
export async function collaborativeUpload(
  serverUrl: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult[]> {
  const client = new CollaborativeUploadClient({
    serverUrl,
    role: 'master',
    onProgress
  })

  try {
    await client.connect()
    const results = await client.submitTasks(files)
    return results
  } finally {
    client.disconnect()
  }
}
