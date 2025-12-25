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
  autoReconnect?: boolean // 是否自动重连（默认 true）
  reconnectDelay?: number // 重连延迟（毫秒，默认 5000）
  taskTimeout?: number // 任务超时时间（毫秒，默认 60000）
  onStatusChange?: (status: ConnectionStatus) => void
  onProgress?: (progress: UploadProgress) => void
  onWorkerStats?: (stats: WorkerStats) => void
  onLocalUploadComplete?: (filename: string, url: string) => void // 本地上传完成回调
  onRemoteUploadComplete?: (filename: string, url: string) => void // 远程上传完成回调（来自工作者）
  onDisconnect?: (pendingTasks: string[]) => void // 断线时回调，返回未完成的远程任务文件名
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
  // 429 rate limit waiting state
  waitingFor?: number // seconds to wait
  waitStart?: number // timestamp when waiting started
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

  // 用于连接完成时的回调（等待 SESSION_CREATED 或 WORKER_REGISTERED）
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null

  // 用于主控端等待会话完成
  private sessionCompleteResolve: ((results: UploadResult[]) => void) | null = null
  // @ts-expect-error kept for potential future use (reject on fatal errors)
  private sessionReject: ((error: Error) => void) | null = null // 用于断线时 reject
  private sessionResults: UploadResult[] = []
  private localUploadResults: UploadResult[] = [] // 本地上传结果
  private totalExpected: number = 0 // 期望完成的总数
  private pendingRemoteFiles: string[] = [] // 正在等待远程上传的文件名
  private taskTimeoutTimer: ReturnType<typeof setTimeout> | null = null // 任务超时定时器
  private isUploading: boolean = false // 是否正在上传中

  // Worker mode local statistics
  private workerStats: WorkerStats = { completed: 0, failed: 0, totalBytes: 0 }

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
   * 对于 master 角色，会等待 SESSION_CREATED 消息后才 resolve
   * 对于 worker 角色，会等待 WORKER_REGISTERED 消息后才 resolve
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl)

        // Store resolve/reject for later use when response is received
        this.connectResolve = resolve
        this.connectReject = reject

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
          // Note: resolve() is now called in handleMessage when SESSION_CREATED or WORKER_REGISTERED is received
        }

        this.ws.onmessage = event => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = () => {
          console.log('[CollaborativeUpload] Disconnected from server')
          this._status.connected = false
          this.stopHeartbeat()
          this.config.onStatusChange?.(this._status)

          // If we were still waiting for connection to complete, reject
          if (this.connectReject) {
            this.connectReject(new Error('Connection closed before initialization complete'))
            this.connectResolve = null
            this.connectReject = null
          }

          // 处理断线时的任务失败
          this.handleDisconnectDuringUpload()

          // 自动重连（仅在配置允许时）
          const autoReconnect = this.config.autoReconnect !== false
          if (autoReconnect && !this.reconnectTimer) {
            const delay = this.config.reconnectDelay || 5000
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null
              this.connect().catch(console.error)
            }, delay)
          }
        }

        this.ws.onerror = error => {
          console.error('[CollaborativeUpload] WebSocket error:', error)
          if (this.connectReject) {
            this.connectReject(error instanceof Error ? error : new Error('WebSocket error'))
            this.connectResolve = null
            this.connectReject = null
          }
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
   * 处理上传过程中的断线
   * 将未完成的远程任务标记为失败，并通知调用方
   */
  private handleDisconnectDuringUpload(): void {
    if (!this.isUploading) return

    console.log(
      '[CollaborativeUpload] Disconnected during upload, pending remote files:',
      this.pendingRemoteFiles
    )

    // 清除超时定时器
    if (this.taskTimeoutTimer) {
      clearTimeout(this.taskTimeoutTimer)
      this.taskTimeoutTimer = null
    }

    // 通知调用方有未完成的任务
    if (this.pendingRemoteFiles.length > 0) {
      this.config.onDisconnect?.(this.pendingRemoteFiles)

      // 将未完成的远程任务标记为失败
      for (const filename of this.pendingRemoteFiles) {
        // 检查是否已经有这个文件的结果
        const hasResult = this.sessionResults.some(r => r.filename === filename)
        if (!hasResult) {
          this.sessionResults.push({
            filename,
            success: false,
            error: '服务器连接断开'
          })
        }
      }
      this.pendingRemoteFiles = []
    }

    // 更新进度显示
    this.config.onProgress?.({
      completed:
        this.sessionResults.filter(r => r.success).length +
        this.localUploadResults.filter(r => r.success).length,
      failed:
        this.sessionResults.filter(r => !r.success).length +
        this.localUploadResults.filter(r => !r.success).length,
      total: this.totalExpected
    })

    // 如果还有 Promise 在等待，resolve 它（返回当前结果，包含失败的任务）
    if (this.sessionCompleteResolve) {
      const allResults = [...this.localUploadResults, ...this.sessionResults]
      this.sessionCompleteResolve(allResults)
      this.sessionCompleteResolve = null
      this.sessionReject = null
      this.isUploading = false
    }
  }

  /**
   * 启动任务超时定时器
   */
  private startTaskTimeout(): void {
    if (this.taskTimeoutTimer) {
      clearTimeout(this.taskTimeoutTimer)
    }

    const timeout = this.config.taskTimeout || 60000 // 默认 60 秒

    this.taskTimeoutTimer = setTimeout(() => {
      console.log('[CollaborativeUpload] Task timeout reached')

      // 将未完成的远程任务标记为超时
      for (const filename of this.pendingRemoteFiles) {
        const hasResult = this.sessionResults.some(r => r.filename === filename)
        if (!hasResult) {
          this.sessionResults.push({
            filename,
            success: false,
            error: '上传超时'
          })
        }
      }
      this.pendingRemoteFiles = []

      // 触发完成检查
      this.checkAllComplete()
    }, timeout)
  }

  /**
   * 重置任务超时（当有进展时调用）
   */
  private resetTaskTimeout(): void {
    if (this.taskTimeoutTimer && this.pendingRemoteFiles.length > 0) {
      this.startTaskTimeout()
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
          // Resolve connection promise - worker is now fully registered
          if (this.connectResolve) {
            this.connectResolve()
            this.connectResolve = null
            this.connectReject = null
          }
          break

        case 'SESSION_CREATED':
          this._sessionId = data.sessionId
          this._status.sessionId = data.sessionId
          this._serverStats = data.serverStats
          console.log('[CollaborativeUpload] Session created:', data.sessionId)
          this.config.onStatusChange?.(this._status)
          // Resolve connection promise - master session is now ready
          if (this.connectResolve) {
            this.connectResolve()
            this.connectResolve = null
            this.connectReject = null
          }
          break

        case 'TASKS_SUBMITTED':
          console.log('[CollaborativeUpload] Tasks submitted:', data.taskCount)
          break

        case 'TASK_ASSIGNED':
          // 工作者收到任务
          this.handleTaskAssigned(data.task)
          break

        case 'TASK_WAITING':
          // 主控端收到工作者等待通知（429 rate limit）
          console.log(`[CollaborativeUpload] Worker waiting on ${data.filename}: ${data.waitTime}s`)
          this.config.onProgress?.({
            completed:
              this.sessionResults.filter(r => r.success).length +
              this.localUploadResults.filter(r => r.success).length,
            failed:
              this.sessionResults.filter(r => !r.success).length +
              this.localUploadResults.filter(r => !r.success).length,
            total: this.totalExpected,
            currentFile: data.filename,
            waitingFor: data.waitTime,
            waitStart: data.waitStart
          })
          break

        case 'TASK_COMPLETED':
          // 主控端收到任务完成通知（来自远程工作者）
          this.sessionResults.push({
            filename: data.filename,
            success: true,
            url: data.resultUrl
          })
          // 从待处理列表中移除
          this.pendingRemoteFiles = this.pendingRemoteFiles.filter(f => f !== data.filename)
          // 重置超时（有进展时）
          this.resetTaskTimeout()
          // 回调通知远程上传完成
          this.config.onRemoteUploadComplete?.(data.filename, data.resultUrl)
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
          // 从待处理列表中移除
          this.pendingRemoteFiles = this.pendingRemoteFiles.filter(f => f !== data.filename)
          // 重置超时（有进展时）
          this.resetTaskTimeout()
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

      // Rate limit wait callback - notify master when waiting
      const onRateLimitWait = async (waitTime: number): Promise<void> => {
        console.log(`[CollaborativeUpload] Worker rate limited, waiting ${waitTime / 1000}s...`)
        this.send({
          type: 'TASK_WAITING',
          taskId: task.id,
          filename: task.filename,
          waitTime: waitTime / 1000,
          waitStart: Date.now()
        })
      }

      // 执行上传
      const resultUrl = await uploadServices['linux.do'].uploadFile(
        file,
        undefined,
        onRateLimitWait
      )

      // 报告成功
      this.send({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        resultUrl
      })

      // 更新本地统计
      this.workerStats.completed++
      this.workerStats.totalBytes += task.size
      this.config.onWorkerStats?.(this.workerStats)
    } catch (error) {
      console.error('[CollaborativeUpload] Task failed:', error)

      // 报告失败
      this.send({
        type: 'TASK_FAILED',
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      })

      // 更新本地统计
      this.workerStats.failed++
      this.config.onWorkerStats?.(this.workerStats)
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
    this.pendingRemoteFiles = []
    this.isUploading = true

    if (!masterAlsoUploads || files.length === 0) {
      // 如果主机不参与上传，全部交给工作者
      this.pendingRemoteFiles = files.map(f => f.name)
      const tasks = await this.prepareTasksData(files)
      this.send({
        type: 'SUBMIT_TASKS',
        sessionId: this._sessionId,
        tasks
      })

      // 启动超时定时器
      if (files.length > 0) {
        this.startTaskTimeout()
      }

      return new Promise((resolve, reject) => {
        this.sessionCompleteResolve = resolve
        this.sessionReject = reject
      })
    }

    // 主机也参与上传：根据工作者数量动态分配任务
    // 策略：主机算作 1 个节点，与所有工作者平均分配任务
    const workerCount = this._serverStats?.workerCount ?? 0
    const totalNodes = 1 + workerCount // 主机 + 工作者
    const localCount = Math.ceil(files.length / totalNodes)
    const localFiles = files.slice(0, localCount)
    const remoteFiles = files.slice(localCount)

    console.log(
      `[CollaborativeUpload] Dynamic load balancing: ${totalNodes} nodes (1 master + ${workerCount} workers)`
    )

    // 记录远程文件名
    this.pendingRemoteFiles = remoteFiles.map(f => f.name)

    console.log(
      `[CollaborativeUpload] Task split: ${localCount} local, ${remoteFiles.length} remote`
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

      // 启动超时定时器
      this.startTaskTimeout()
    }

    // 等待所有任务完成（本地 + 远程）
    return new Promise((resolve, reject) => {
      this.sessionCompleteResolve = resolve
      this.sessionReject = reject

      // 如果没有远程任务，需要自己触发完成检查
      if (remoteFiles.length === 0) {
        // 本地任务完成后会调用 checkAllComplete
      }
    })
  }

  /**
   * 准备任务数据
   * 使用批量处理避免同时加载所有文件到内存
   * @param files - 要处理的文件列表
   * @param batchSize - 每批处理的文件数量（默认 5）
   */
  private async prepareTasksData(files: File[], batchSize: number = 5): Promise<UploadTask[]> {
    const results: UploadTask[] = []

    // Process files in batches to prevent memory exhaustion
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async file => {
          const arrayBuffer = await file.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)

          // Use chunked approach for efficient Base64 conversion
          // Process in 32KB chunks to avoid stack overflow and reduce memory fragmentation
          const CHUNK_SIZE = 32768
          const chunks: string[] = []
          for (let j = 0; j < bytes.length; j += CHUNK_SIZE) {
            const chunk = bytes.subarray(j, Math.min(j + CHUNK_SIZE, bytes.length))
            chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]))
          }
          const dataBase64 = btoa(chunks.join(''))

          return {
            filename: file.name,
            mimeType: file.type,
            dataBase64,
            size: file.size
          }
        })
      )
      results.push(...batchResults)
    }

    return results
  }

  /**
   * 本地上传文件（并行处理，带并发控制）
   * @param files - 要上传的文件数组
   * @param concurrency - 并发数限制，默认为 3
   */
  private async uploadLocalFiles(files: File[], concurrency: number = 3): Promise<void> {
    // Helper function to upload a single file
    const uploadSingleFile = async (file: File): Promise<void> => {
      try {
        console.log(`[CollaborativeUpload] Local upload: ${file.name}`)

        // Rate limit wait callback
        const onRateLimitWait = async (waitTime: number): Promise<void> => {
          console.log(`[CollaborativeUpload] Rate limited, waiting ${waitTime / 1000}s...`)
          this.config.onProgress?.({
            completed:
              this.sessionResults.filter(r => r.success).length +
              this.localUploadResults.filter(r => r.success).length,
            failed:
              this.sessionResults.filter(r => !r.success).length +
              this.localUploadResults.filter(r => !r.success).length,
            total: this.totalExpected,
            currentFile: file.name,
            waitingFor: waitTime / 1000,
            waitStart: Date.now()
          })
        }

        const resultUrl = await uploadServices['linux.do'].uploadFile(
          file,
          undefined,
          onRateLimitWait
        )

        // Clear waiting state after successful upload
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

    // Process files with concurrency control
    const queue = [...files]
    const executing: Promise<void>[] = []

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to concurrency limit
      while (queue.length > 0 && executing.length < concurrency) {
        const file = queue.shift()!
        const promise = uploadSingleFile(file).then(() => {
          // Remove from executing when done
          executing.splice(executing.indexOf(promise), 1)
        })
        executing.push(promise)
      }

      // Wait for at least one to complete if we're at the limit
      if (executing.length >= concurrency || (queue.length === 0 && executing.length > 0)) {
        await Promise.race(executing)
      }
    }
  }

  /**
   * 检查是否所有任务都完成了
   */
  private checkAllComplete(): void {
    const totalCompleted = this.sessionResults.length + this.localUploadResults.length
    if (totalCompleted >= this.totalExpected && this.sessionCompleteResolve) {
      // 清理超时定时器
      if (this.taskTimeoutTimer) {
        clearTimeout(this.taskTimeoutTimer)
        this.taskTimeoutTimer = null
      }

      // 重置上传状态
      this.isUploading = false
      this.pendingRemoteFiles = []

      const allResults = [...this.localUploadResults, ...this.sessionResults]
      this.sessionCompleteResolve(allResults)
      this.sessionCompleteResolve = null
      this.sessionReject = null
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
