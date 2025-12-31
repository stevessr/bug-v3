export interface CollaborativeUploadConfig {
  serverUrl: string // WebSocket 服务器地址，如 ws://localhost:9527
  role: 'master' | 'worker' // 主控端或工作者
  autoReconnect?: boolean // 是否自动重连（默认 true）
  reconnectDelay?: number // 重连延迟（毫秒）
  taskTimeout?: number // 任务超时时间（毫秒）
  onStatusChange?: (status: ConnectionStatus) => void
  onProgress?: (progress: UploadProgress) => void
  onWorkerStats?: (stats: WorkerStats) => void
  onRemoteUploadComplete?: (filename: string, url: string) => void // 远程上传完成回调（来自工作者）
  onDisconnect?: (pendingTasks: string[]) => void // 断线时回调，返回未完成的远程任务文件名
  onCurrentTask?: (task: { filename: string; status: string } | null) => void // Worker 当前任务回调
}

export interface ConnectionStatus {
  connected: boolean
  serverUrl: string
  role: 'master' | 'worker'
  workerId?: string
  sessionId?: string
  uuid?: string // 当前节点的 UUID
}

export interface UploadProgress {
  completed: number
  failed: number
  total: number
  currentFile?: string
  // 429 rate limit waiting state
  waitingFor?: number // seconds to wait
  waitStart?: number // timestamp when waiting started
  waitingWorkerId?: string // which worker is waiting (for 429)
  // Node file distribution (worker ID -> list of files)
  nodeFiles?: Record<string, string[]> // e.g., { "worker-1": ["file1.png", "file2.png"], "master": ["file3.png"] }
  // UUID information
  masterUuid?: string // Master 节点的 UUID
  currentUuid?: string // 当前节点的 UUID
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
  size: number
  taskId?: string // 用于二进制传输时关联数据
}

export interface UploadTaskWithData extends UploadTask {
  data: ArrayBuffer // 二进制数据
}

export interface UploadResult {
  filename: string
  success: boolean
  url?: string
  error?: string
}

export type MessageHandler = (data: any) => void
