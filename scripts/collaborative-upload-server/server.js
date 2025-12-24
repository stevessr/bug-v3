/**
 * 联动上传协调服务器
 *
 * 功能：
 * 1. 管理上传任务队列
 * 2. 协调多个工作者并行上传
 * 3. 收集上传结果并返回给主控端
 *
 * 使用方法：
 *   node server.js [port]
 *   默认端口：9527
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { randomUUID } from 'crypto'

const PORT = parseInt(process.argv[2]) || 9527

// ==================== 数据结构 ====================

/** @type {Map<string, Worker>} 已注册的工作者 */
const workers = new Map()

/** @type {Map<string, UploadTask>} 待处理的上传任务 */
const pendingTasks = new Map()

/** @type {Map<string, UploadTask>} 进行中的任务 */
const activeTasks = new Map()

/** @type {Map<string, UploadSession>} 上传会话（主控端发起） */
const sessions = new Map()

/**
 * @typedef {Object} Worker
 * @property {string} id - 工作者 ID
 * @property {WebSocket} ws - WebSocket 连接
 * @property {string} status - 状态：idle, busy, offline
 * @property {number} lastHeartbeat - 最后心跳时间
 * @property {string|null} currentTaskId - 当前处理的任务 ID
 * @property {WorkerStats} stats - 统计信息
 */

/**
 * @typedef {Object} WorkerStats
 * @property {number} completed - 完成任务数
 * @property {number} failed - 失败任务数
 * @property {number} totalBytes - 总上传字节数
 */

/**
 * @typedef {Object} UploadTask
 * @property {string} id - 任务 ID
 * @property {string} sessionId - 所属会话 ID
 * @property {string} filename - 文件名
 * @property {string} mimeType - MIME 类型
 * @property {string} dataBase64 - Base64 编码的文件数据
 * @property {number} size - 文件大小
 * @property {string} status - 状态：pending, assigned, uploading, completed, failed
 * @property {string|null} assignedWorker - 分配的工作者 ID
 * @property {string|null} resultUrl - 上传结果 URL
 * @property {string|null} error - 错误信息
 * @property {number} retryCount - 重试次数
 * @property {number} createdAt - 创建时间
 */

/**
 * @typedef {Object} UploadSession
 * @property {string} id - 会话 ID
 * @property {WebSocket} ws - 主控端 WebSocket
 * @property {string[]} taskIds - 该会话的所有任务 ID
 * @property {number} totalTasks - 总任务数
 * @property {number} completedTasks - 完成任务数
 * @property {number} failedTasks - 失败任务数
 * @property {number} createdAt - 创建时间
 */

// ==================== 辅助函数 ====================

function log(message, ...args) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, ...args)
}

function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message)
  for (const worker of workers.values()) {
    if (worker.ws !== excludeWs && worker.ws.readyState === WebSocket.OPEN) {
      worker.ws.send(data)
    }
  }
  for (const session of sessions.values()) {
    if (session.ws !== excludeWs && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(data)
    }
  }
}

function sendToClient(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function getIdleWorker() {
  for (const worker of workers.values()) {
    if (worker.status === 'idle') {
      return worker
    }
  }
  return null
}

function getServerStats() {
  const workerList = Array.from(workers.values()).map(w => ({
    id: w.id,
    status: w.status,
    stats: w.stats
  }))

  return {
    workers: workerList,
    workerCount: workers.size,
    idleWorkers: workerList.filter(w => w.status === 'idle').length,
    pendingTasks: pendingTasks.size,
    activeTasks: activeTasks.size,
    activeSessions: sessions.size
  }
}

// ==================== 任务调度 ====================

function assignTaskToWorker(task, worker) {
  task.status = 'assigned'
  task.assignedWorker = worker.id
  worker.status = 'busy'
  worker.currentTaskId = task.id

  pendingTasks.delete(task.id)
  activeTasks.set(task.id, task)

  log(`Task ${task.id} assigned to worker ${worker.id}`)

  sendToClient(worker.ws, {
    type: 'TASK_ASSIGNED',
    task: {
      id: task.id,
      filename: task.filename,
      mimeType: task.mimeType,
      dataBase64: task.dataBase64,
      size: task.size
    }
  })
}

function getAllIdleWorkers() {
  const idleWorkers = []
  for (const worker of workers.values()) {
    if (worker.status === 'idle') {
      idleWorkers.push(worker)
    }
  }
  return idleWorkers
}

function scheduleNextTask() {
  if (pendingTasks.size === 0) return

  // 获取所有空闲的工作者
  const idleWorkers = getAllIdleWorkers()
  if (idleWorkers.length === 0) return

  // 获取待处理任务的迭代器
  const taskIterator = pendingTasks.values()

  // 为每个空闲工作者分配一个任务
  for (const worker of idleWorkers) {
    const taskResult = taskIterator.next()
    if (taskResult.done) break // 没有更多任务了

    const task = taskResult.value
    assignTaskToWorker(task, worker)
  }

  log(`Scheduled tasks: ${idleWorkers.length} workers, ${pendingTasks.size} remaining`)
}

function handleTaskComplete(workerId, taskId, resultUrl) {
  const task = activeTasks.get(taskId)
  if (!task) {
    log(`Warning: Task ${taskId} not found in active tasks`)
    return
  }

  const worker = workers.get(workerId)
  if (worker) {
    worker.status = 'idle'
    worker.currentTaskId = null
    worker.stats.completed++
    worker.stats.totalBytes += task.size
  }

  task.status = 'completed'
  task.resultUrl = resultUrl
  activeTasks.delete(taskId)

  log(`Task ${taskId} completed by worker ${workerId}: ${resultUrl}`)

  // 通知会话
  const session = sessions.get(task.sessionId)
  if (session) {
    session.completedTasks++
    sendToClient(session.ws, {
      type: 'TASK_COMPLETED',
      taskId: task.id,
      filename: task.filename,
      resultUrl: resultUrl,
      progress: {
        completed: session.completedTasks,
        failed: session.failedTasks,
        total: session.totalTasks
      }
    })

    // 检查会话是否完成
    if (session.completedTasks + session.failedTasks >= session.totalTasks) {
      sendToClient(session.ws, {
        type: 'SESSION_COMPLETED',
        sessionId: session.id,
        stats: {
          completed: session.completedTasks,
          failed: session.failedTasks,
          total: session.totalTasks
        }
      })
    }
  }

  // 调度下一个任务
  scheduleNextTask()
}

function handleTaskFailed(workerId, taskId, error) {
  const task = activeTasks.get(taskId)
  if (!task) {
    log(`Warning: Task ${taskId} not found in active tasks`)
    return
  }

  const worker = workers.get(workerId)
  if (worker) {
    worker.status = 'idle'
    worker.currentTaskId = null
    worker.stats.failed++
  }

  task.retryCount++

  log(`Task ${taskId} failed (attempt ${task.retryCount}): ${error}`)

  // 重试逻辑
  if (task.retryCount < 3) {
    task.status = 'pending'
    task.assignedWorker = null
    activeTasks.delete(taskId)
    pendingTasks.set(taskId, task)
    log(`Task ${taskId} queued for retry`)
  } else {
    task.status = 'failed'
    task.error = error
    activeTasks.delete(taskId)

    // 通知会话
    const session = sessions.get(task.sessionId)
    if (session) {
      session.failedTasks++
      sendToClient(session.ws, {
        type: 'TASK_FAILED',
        taskId: task.id,
        filename: task.filename,
        error: error,
        progress: {
          completed: session.completedTasks,
          failed: session.failedTasks,
          total: session.totalTasks
        }
      })

      // 检查会话是否完成
      if (session.completedTasks + session.failedTasks >= session.totalTasks) {
        sendToClient(session.ws, {
          type: 'SESSION_COMPLETED',
          sessionId: session.id,
          stats: {
            completed: session.completedTasks,
            failed: session.failedTasks,
            total: session.totalTasks
          }
        })
      }
    }
  }

  // 调度下一个任务
  scheduleNextTask()
}

// ==================== 消息处理 ====================

function handleMessage(ws, clientId, message) {
  try {
    const data = JSON.parse(message)

    switch (data.type) {
      // 工作者注册
      case 'WORKER_REGISTER': {
        const worker = {
          id: clientId,
          ws,
          status: 'idle',
          lastHeartbeat: Date.now(),
          currentTaskId: null,
          stats: { completed: 0, failed: 0, totalBytes: 0 }
        }
        workers.set(clientId, worker)
        log(`Worker registered: ${clientId}`)

        sendToClient(ws, {
          type: 'WORKER_REGISTERED',
          workerId: clientId,
          serverStats: getServerStats()
        })

        broadcast({
          type: 'STATS_UPDATE',
          stats: getServerStats()
        })

        // 有新工作者加入，尝试调度任务
        scheduleNextTask()
        break
      }

      // 工作者心跳
      case 'WORKER_HEARTBEAT': {
        const worker = workers.get(clientId)
        if (worker) {
          worker.lastHeartbeat = Date.now()
        }
        break
      }

      // 主控端创建上传会话
      case 'CREATE_SESSION': {
        const sessionId = randomUUID()
        const session = {
          id: sessionId,
          ws,
          taskIds: [],
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          createdAt: Date.now()
        }
        sessions.set(sessionId, session)
        log(`Session created: ${sessionId}`)

        sendToClient(ws, {
          type: 'SESSION_CREATED',
          sessionId,
          serverStats: getServerStats()
        })
        break
      }

      // 主控端提交上传任务
      case 'SUBMIT_TASKS': {
        const session = sessions.get(data.sessionId)
        if (!session) {
          sendToClient(ws, {
            type: 'ERROR',
            message: 'Session not found'
          })
          break
        }

        const tasks = data.tasks || []
        for (const taskData of tasks) {
          const task = {
            id: randomUUID(),
            sessionId: data.sessionId,
            filename: taskData.filename,
            mimeType: taskData.mimeType,
            dataBase64: taskData.dataBase64,
            size: taskData.size || 0,
            status: 'pending',
            assignedWorker: null,
            resultUrl: null,
            error: null,
            retryCount: 0,
            createdAt: Date.now()
          }

          pendingTasks.set(task.id, task)
          session.taskIds.push(task.id)
          session.totalTasks++
        }

        log(`Session ${data.sessionId}: ${tasks.length} tasks submitted`)

        sendToClient(ws, {
          type: 'TASKS_SUBMITTED',
          sessionId: data.sessionId,
          taskCount: tasks.length,
          totalPending: pendingTasks.size
        })

        // 开始调度
        scheduleNextTask()
        break
      }

      // 工作者报告任务完成
      case 'TASK_COMPLETED': {
        handleTaskComplete(clientId, data.taskId, data.resultUrl)
        break
      }

      // 工作者报告任务失败
      case 'TASK_FAILED': {
        handleTaskFailed(clientId, data.taskId, data.error)
        break
      }

      // 工作者报告等待中（429 rate limit）
      case 'TASK_WAITING': {
        const task = activeTasks.get(data.taskId)
        if (task) {
          const session = sessions.get(task.sessionId)
          if (session) {
            // 转发等待通知给主控端
            sendToClient(session.ws, {
              type: 'TASK_WAITING',
              taskId: data.taskId,
              filename: data.filename,
              waitTime: data.waitTime,
              waitStart: data.waitStart,
              workerId: clientId
            })
            log(`Worker ${clientId} waiting on task ${data.taskId}: ${data.waitTime}s`)
          }
        }
        break
      }

      // 获取服务器状态
      case 'GET_STATS': {
        sendToClient(ws, {
          type: 'STATS_UPDATE',
          stats: getServerStats()
        })
        break
      }

      default:
        log(`Unknown message type: ${data.type}`)
    }
  } catch (error) {
    log(`Error handling message: ${error.message}`)
  }
}

function handleDisconnect(clientId) {
  const worker = workers.get(clientId)
  if (worker) {
    workers.delete(clientId)
    log(`Worker disconnected: ${clientId}`)

    // 重新分配该工作者的任务
    if (worker.currentTaskId) {
      const task = activeTasks.get(worker.currentTaskId)
      if (task) {
        task.status = 'pending'
        task.assignedWorker = null
        activeTasks.delete(task.id)
        pendingTasks.set(task.id, task)
        log(`Task ${task.id} reassigned to queue`)
      }
    }

    broadcast({
      type: 'STATS_UPDATE',
      stats: getServerStats()
    })

    scheduleNextTask()
  }

  // 检查是否是会话断开
  for (const [sessionId, session] of sessions.entries()) {
    if (session.ws.clientId === clientId) {
      sessions.delete(sessionId)
      log(`Session disconnected: ${sessionId}`)
      // 清理该会话的待处理任务
      for (const taskId of session.taskIds) {
        pendingTasks.delete(taskId)
        activeTasks.delete(taskId)
      }
      break
    }
  }
}

// ==================== 服务器启动 ====================

const server = createServer((req, res) => {
  // 简单的 HTTP 状态页面
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(getServerStats(), null, 2))
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>联动上传协调服务器</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    .stats { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .stat-item { margin: 10px 0; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <h1>联动上传协调服务器</h1>
  <div class="stats" id="stats">加载中...</div>
  <script>
    async function updateStats() {
      try {
        const res = await fetch('/status')
        const stats = await res.json()
        document.getElementById('stats').innerHTML = \`
          <div class="stat-item"><span class="label">工作者数量：</span> \${stats.workerCount} (空闲：\${stats.idleWorkers})</div>
          <div class="stat-item"><span class="label">待处理任务：</span> \${stats.pendingTasks}</div>
          <div class="stat-item"><span class="label">进行中任务：</span> \${stats.activeTasks}</div>
          <div class="stat-item"><span class="label">活跃会话：</span> \${stats.activeSessions}</div>
          <hr>
          <div class="stat-item"><span class="label">工作者列表：</span></div>
          \${stats.workers.map(w => \`
            <div style="margin-left: 20px;">
              ID: \${w.id.slice(0, 8)}... | 状态：\${w.status} | 完成：\${w.stats.completed} | 失败：\${w.stats.failed}
            </div>
          \`).join('')}
        \`
      } catch (e) {
        document.getElementById('stats').textContent = '获取状态失败：' + e.message
      }
    }
    updateStats()
    setInterval(updateStats, 2000)
  </script>
</body>
</html>
    `)
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  const clientId = randomUUID()
  ws.clientId = clientId

  log(`Client connected: ${clientId}`)

  ws.on('message', (message) => {
    handleMessage(ws, clientId, message.toString())
  })

  ws.on('close', () => {
    handleDisconnect(clientId)
  })

  ws.on('error', (error) => {
    log(`WebSocket error for ${clientId}: ${error.message}`)
  })
})

// 定期清理断开的连接和超时任务
setInterval(() => {
  const now = Date.now()

  // 检查工作者心跳超时 (30 秒)
  for (const [id, worker] of workers.entries()) {
    if (now - worker.lastHeartbeat > 30000) {
      log(`Worker ${id} heartbeat timeout`)
      worker.ws.terminate()
      handleDisconnect(id)
    }
  }

  // 检查超时任务 (5 分钟)
  for (const [id, task] of activeTasks.entries()) {
    if (now - task.createdAt > 5 * 60 * 1000) {
      log(`Task ${id} timeout`)
      handleTaskFailed(task.assignedWorker, id, 'Task timeout')
    }
  }
}, 10000)

server.listen(PORT, () => {
  log(`===========================================`)
  log(`  联动上传协调服务器已启动`)
  log(`  WebSocket: ws://localhost:${PORT}`)
  log(`  状态页面：http://localhost:${PORT}`)
  log(`===========================================`)
})
