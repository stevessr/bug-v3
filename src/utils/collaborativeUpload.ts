/**
 * 联动上传客户端
 * 用于连接本地协调服务器，支持作为主控端或工作者
 * 主机本身也参与上传，实现真正的并行
 */

import { uploadServices } from './uploadServices'

export interface CollaborativeUploadConfig {
  serverUrl: string // WebSocket 服务器地址，如 ws://localhost:9527
  role: 'master' | 'worker' // 主控端或工作者
  masterAlsoUploads?: boolean // 主机是否也参与上传（默认 true）
  onStatusChange?: (status: ConnectionStatus) => void
  onProgress?: (progress: UploadProgress) => void
  onWorkerStats?: (stats: WorkerStats) => void
  onLocalUploadComplete?: (filename: string, url: string) => void // 本地上传完成回调
}

export interface ConnectionStatus {
  connected: boolean
  serverUrl: string
  role: 'master' | 'worker'
  workerId?: string
  sessionId?: string
}

export interface UploadProgress {
  completed: number
  failed: number
  total: number
  currentFile?: string
}

export interface WorkerStats {
  completed: number
  failed: number
  totalBytes: number
}

export interface ServerStats {
  workerCount: number
  idleWorkers: number
  pendingTasks: number
  activeTasks: number
  activeSessions: number
  workers: Array<{
    id: string
    status: string
    stats: WorkerStats
  }>
}

export interface UploadTask {
  filename: string
  mimeType: string
  dataBase64: string
  size: number
}

export interface UploadResult {
  filename: string
  success: boolean
  url?: string
  error?: string
}

type MessageHandler = (data: any) => void

/**
 * 联动上传客户端类
 */
export class CollaborativeUploadClient {
  private ws: WebSocket | null = null
  private config: CollaborativeUploadConfig
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private messageHandlers: Map<string, MessageHandler[]> = new Map()

  private _status: ConnectionStatus
  private _serverStats: ServerStats | null = null
  private _sessionId: string | null = null
  // @ts-expect-error kept for API compatibility
  private _workerId: string | null = null

  // 用于主控端等待会话完成
  private sessionCompleteResolve: ((results: UploadResult[]) => void) | null = null
  private sessionResults: UploadResult[] = []
  private localUploadResults: UploadResult[] = [] // 本地上传结果
  private totalExpected: number = 0 // 期望完成的总数

  constructor(config: CollaborativeUploadConfig) {
    this.config = config
    this._status = {
      connected: false,
      serverUrl: config.serverUrl,
      role: config.role
    }
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get serverStats(): ServerStats | null {
    return this._serverStats
  }

  get sessionId(): string | null {
    return this._sessionId
  }

  /**
   * 连接到协调服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl)

        this.ws.onopen = () => {
          console.log('[CollaborativeUpload] Connected to server')
          this._status.connected = true

          // 根据角色注册
          if (this.config.role === 'worker') {
            this.send({ type: 'WORKER_REGISTER' })
            this.startHeartbeat()
          } else {
            this.send({ type: 'CREATE_SESSION' })
          }

          this.config.onStatusChange?.(this._status)
          resolve()
        }

        this.ws.onmessage = event => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = () => {
          console.log('[CollaborativeUpload] Disconnected from server')
          this._status.connected = false
          this.stopHeartbeat()
          this.config.onStatusChange?.(this._status)

          // 自动重连
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null
              this.connect().catch(console.error)
            }, 5000)
          }
        }

        this.ws.onerror = error => {
          console.error('[CollaborativeUpload] WebSocket error:', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this._status.connected = false
    this.config.onStatusChange?.(this._status)
  }

  /**
   * 发送消息
   */
  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'WORKER_HEARTBEAT' })
    }, 10000)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 处理服务器消息
   */
  private handleMessage(rawData: string): void {
    try {
      const data = JSON.parse(rawData)

      switch (data.type) {
        case 'WORKER_REGISTERED':
          this._workerId = data.workerId
          this._status.workerId = data.workerId
          this._serverStats = data.serverStats
          console.log('[CollaborativeUpload] Registered as worker:', data.workerId)
          this.config.onStatusChange?.(this._status)
          break

        case 'SESSION_CREATED':
          this._sessionId = data.sessionId
          this._status.sessionId = data.sessionId
          this._serverStats = data.serverStats
          console.log('[CollaborativeUpload] Session created:', data.sessionId)
          this.config.onStatusChange?.(this._status)
          break

        case 'TASKS_SUBMITTED':
          console.log('[CollaborativeUpload] Tasks submitted:', data.taskCount)
          break

        case 'TASK_ASSIGNED':
          // 工作者收到任务
          this.handleTaskAssigned(data.task)
          break

        case 'TASK_COMPLETED':
          // 主控端收到任务完成通知（来自远程工作者）
          this.sessionResults.push({
            filename: data.filename,
            success: true,
            url: data.resultUrl
          })
          this.config.onProgress?.({
            completed:
              this.sessionResults.filter(r => r.success).length +
              this.localUploadResults.filter(r => r.success).length,
            failed:
              this.sessionResults.filter(r => !r.success).length +
              this.localUploadResults.filter(r => !r.success).length,
            total: this.totalExpected,
            currentFile: data.filename
          })
          this.checkAllComplete()
          break

        case 'TASK_FAILED':
          // 主控端收到任务失败通知（来自远程工作者）
          this.sessionResults.push({
            filename: data.filename,
            success: false,
            error: data.error
          })
          this.config.onProgress?.({
            completed:
              this.sessionResults.filter(r => r.success).length +
              this.localUploadResults.filter(r => r.success).length,
            failed:
              this.sessionResults.filter(r => !r.success).length +
              this.localUploadResults.filter(r => !r.success).length,
            total: this.totalExpected,
            currentFile: data.filename
          })
          this.checkAllComplete()
          break

        case 'SESSION_COMPLETED':
          // 服务器通知会话完成（仅远程任务）
          console.log('[CollaborativeUpload] Remote session completed:', data.stats)
          // 不在这里 resolve，由 checkAllComplete 统一处理
          this.checkAllComplete()
          break

        case 'STATS_UPDATE':
          this._serverStats = data.stats
          break

        case 'ERROR':
          console.error('[CollaborativeUpload] Server error:', data.message)
          break

        default:
          console.log('[CollaborativeUpload] Unknown message:', data.type)
      }

      // 调用注册的处理器
      const handlers = this.messageHandlers.get(data.type) || []
      handlers.forEach(handler => handler(data))
    } catch (error) {
      console.error('[CollaborativeUpload] Error parsing message:', error)
    }
  }

  /**
   * 工作者处理分配的任务
   */
  private async handleTaskAssigned(task: {
    id: string
    filename: string
    mimeType: string
    dataBase64: string
    size: number
  }): Promise<void> {
    console.log('[CollaborativeUpload] Task assigned:', task.id, task.filename)

    try {
      // 将 Base64 转换为 File
      const binaryString = atob(task.dataBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: task.mimeType })
      const file = new File([blob], task.filename, { type: task.mimeType })

      // 执行上传
      const resultUrl = await uploadServices['linux.do'].uploadFile(file)

      // 报告成功
      this.send({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        resultUrl
      })

      // 更新本地统计
      this.config.onWorkerStats?.({
        completed: (this.config.onWorkerStats as any)?.completed + 1 || 1,
        failed: (this.config.onWorkerStats as any)?.failed || 0,
        totalBytes: (this.config.onWorkerStats as any)?.totalBytes + task.size || task.size
      })
    } catch (error) {
      console.error('[CollaborativeUpload] Task failed:', error)

      // 报告失败
      this.send({
        type: 'TASK_FAILED',
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 主控端提交上传任务
   * 主机本身也参与上传，实现真正的并行
   */
  async submitTasks(files: File[]): Promise<UploadResult[]> {
    if (!this._sessionId) {
      throw new Error('Session not created')
    }

    const masterAlsoUploads = this.config.masterAlsoUploads !== false // 默认 true

    // 重置结果
    this.sessionResults = []
    this.localUploadResults = []
    this.totalExpected = files.length

    if (!masterAlsoUploads || files.length === 0) {
      // 如果主机不参与上传，全部交给工作者
      const tasks = await this.prepareTasksData(files)
      this.send({
        type: 'SUBMIT_TASKS',
        sessionId: this._sessionId,
        tasks
      })

      return new Promise(resolve => {
        this.sessionCompleteResolve = resolve
      })
    }

    // 主机也参与上传：分配一部分任务给自己
    // 策略：主机处理一半（向上取整），其余分发给工作者
    const localCount = Math.ceil(files.length / 2)
    const localFiles = files.slice(0, localCount)
    const remoteFiles = files.slice(localCount)

    console.log(
      `[CollaborativeUpload] Split tasks: ${localCount} local, ${remoteFiles.length} remote`
    )

    // 启动本地上传（异步）
    this.uploadLocalFiles(localFiles)

    // 如果有远程任务，提交给服务器
    if (remoteFiles.length > 0) {
      const tasks = await this.prepareTasksData(remoteFiles)
      this.send({
        type: 'SUBMIT_TASKS',
        sessionId: this._sessionId,
        tasks
      })
    }

    // 等待所有任务完成（本地 + 远程）
    return new Promise(resolve => {
      this.sessionCompleteResolve = resolve

      // 如果没有远程任务，需要自己触发完成检查
      if (remoteFiles.length === 0) {
        // 本地任务完成后会调用 checkAllComplete
      }
    })
  }

  /**
   * 准备任务数据
   */
  private async prepareTasksData(files: File[]): Promise<UploadTask[]> {
    return Promise.all(
      files.map(async file => {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const dataBase64 = btoa(binary)

        return {
          filename: file.name,
          mimeType: file.type,
          dataBase64,
          size: file.size
        }
      })
    )
  }

  /**
   * 本地上传文件
   */
  private async uploadLocalFiles(files: File[]): Promise<void> {
    for (const file of files) {
      try {
        console.log(`[CollaborativeUpload] Local upload: ${file.name}`)
        const resultUrl = await uploadServices['linux.do'].uploadFile(file)

        this.localUploadResults.push({
          filename: file.name,
          success: true,
          url: resultUrl
        })

        // 回调通知
        this.config.onLocalUploadComplete?.(file.name, resultUrl)

        // 更新进度
        this.config.onProgress?.({
          completed:
            this.sessionResults.filter(r => r.success).length +
            this.localUploadResults.filter(r => r.success).length,
          failed:
            this.sessionResults.filter(r => !r.success).length +
            this.localUploadResults.filter(r => !r.success).length,
          total: this.totalExpected,
          currentFile: file.name
        })
      } catch (error) {
        console.error(`[CollaborativeUpload] Local upload failed: ${file.name}`, error)
        this.localUploadResults.push({
          filename: file.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // 检查是否全部完成
      this.checkAllComplete()
    }
  }

  /**
   * 检查是否所有任务都完成了
   */
  private checkAllComplete(): void {
    const totalCompleted = this.sessionResults.length + this.localUploadResults.length
    if (totalCompleted >= this.totalExpected && this.sessionCompleteResolve) {
      const allResults = [...this.localUploadResults, ...this.sessionResults]
      this.sessionCompleteResolve(allResults)
      this.sessionCompleteResolve = null
    }
  }

  /**
   * 注册消息处理器
   */
  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, [])
    }
    this.messageHandlers.get(messageType)!.push(handler)
  }

  /**
   * 移除消息处理器
   */
  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 获取服务器状态
   */
  requestStats(): void {
    this.send({ type: 'GET_STATS' })
  }
}

// ==================== 便捷函数 ====================

let workerClient: CollaborativeUploadClient | null = null

/**
 * 启动工作者模式
 */
export async function startWorkerMode(
  serverUrl: string,
  onStatusChange?: (status: ConnectionStatus) => void
): Promise<CollaborativeUploadClient> {
  if (workerClient) {
    workerClient.disconnect()
  }

  workerClient = new CollaborativeUploadClient({
    serverUrl,
    role: 'worker',
    onStatusChange
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
