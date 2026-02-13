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

function isValidBase64(str) {
  try {
    return btoa(atob(str)) === str
  } catch (e) {
    return false
  }
}

function validateTaskData(taskData, binaryMode = false) {
  if (!taskData.filename || typeof taskData.filename !== 'string') {
    return { valid: false, error: 'Invalid filename' }
  }

  if (!taskData.mimeType || typeof taskData.mimeType !== 'string') {
    return { valid: false, error: 'Invalid mimeType' }
  }

  // 二进制模式：数据将通过单独的二进制帧发送，元数据中不需要包含数据
  if (binaryMode) {
    // 只需要 taskId 来关联后续的二进制数据
    if (!taskData.taskId || typeof taskData.taskId !== 'string') {
      return { valid: false, error: 'Binary mode requires taskId' }
    }
    return { valid: true }
  }

  // 非二进制模式：支持两种数据格式：Base64 字符串或二进制数据
  if (taskData.dataBase64 && typeof taskData.dataBase64 === 'string') {
    // Base64 格式数据
    if (!isValidBase64(taskData.dataBase64)) {
      return { valid: false, error: 'Invalid Base64 encoding' }
    }
  } else if (taskData.binaryData && Buffer.isBuffer(taskData.binaryData)) {
    // 二进制格式数据 - 无需 Base64 验证
    if (taskData.binaryData.length === 0) {
      return { valid: false, error: 'Empty binary data' }
    }
  } else {
    return {
      valid: false,
      error: 'Missing or invalid data (expected dataBase64 string or binaryData buffer)'
    }
  }

  return { valid: true }
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

  // 构建任务元数据
  const taskPayload = {
    id: task.id,
    taskId: task.id, // 冗余字段，用于二进制模式识别
    filename: task.filename,
    mimeType: task.mimeType,
    size: task.size
  }

  if (task.binaryData) {
    // 有二进制数据：先发送元数据 JSON，再发送二进制帧
    sendToClient(worker.ws, {
      type: 'TASK_ASSIGNED',
      binaryMode: true,
      task: taskPayload
    })

    // 发送二进制帧给 worker
    // 帧格式：[4 字节 taskId 长度][taskId 字符串][二进制数据]
    const taskIdBuffer = Buffer.from(task.id, 'utf8')
    const lengthBuffer = Buffer.alloc(4)
    lengthBuffer.writeUInt32BE(taskIdBuffer.length, 0)

    const frame = Buffer.concat([lengthBuffer, taskIdBuffer, task.binaryData])
    if (worker.ws.readyState === WebSocket.OPEN) {
      worker.ws.send(frame)
      log(
        `Sent binary data for task ${task.id} to worker ${worker.id} (${task.binaryData.length} bytes)`
      )
    }
  } else if (task.dataBase64) {
    // Base64 模式
    taskPayload.dataBase64 = task.dataBase64
    sendToClient(worker.ws, {
      type: 'TASK_ASSIGNED',
      task: taskPayload
    })
  } else {
    // 没有数据（不应该发生）
    log(`Warning: Task ${task.id} has no data`)
    sendToClient(worker.ws, {
      type: 'TASK_ASSIGNED',
      task: taskPayload,
      error: 'No data available'
    })
  }
}

function getAllIdleWorkers() {
  const idleWorkers = []
  const now = Date.now()

  for (const worker of workers.values()) {
    if (
      worker.status === 'idle' &&
      worker.healthStatus !== 'unhealthy' &&
      (!worker.cooldownUntil || now >= worker.cooldownUntil)
    ) {
      idleWorkers.push(worker)
    }
  }
  return idleWorkers
}

function scheduleNextTask() {
  if (pendingTasks.size === 0) return

  // 获取所有空闲的工作者，按成功率排序
  const idleWorkers = getAllIdleWorkers()
  if (idleWorkers.length === 0) return

  // 按成功率排序工作者（成功率高的优先）
  idleWorkers.sort((a, b) => {
    const aSuccessRate =
      a.stats.completed + a.stats.failed > 0
        ? a.stats.completed / (a.stats.completed + a.stats.failed)
        : 1
    const bSuccessRate =
      b.stats.completed + b.stats.failed > 0
        ? b.stats.completed / (b.stats.completed + b.stats.failed)
        : 1
    return bSuccessRate - aSuccessRate
  })

  // 将待处理任务按优先级排序：考虑重试延迟，只选择状态为 'pending' 的任务
  const now = Date.now()
  const availableTasks = Array.from(pendingTasks.values()).filter(
    task => task.status === 'pending' && (!task.retryAfter || now >= task.retryAfter)
  )

  const sortedTasks = availableTasks.sort((a, b) => {
    // 重试任务优先，但考虑延迟
    if (a.retryCount > 0 && b.retryCount === 0) return -1
    if (a.retryCount === 0 && b.retryCount > 0) return 1
    if (a.retryCount !== b.retryCount) return b.retryCount - a.retryCount

    // 相同重试次数按创建时间排序（早的优先）
    return a.createdAt - b.createdAt
  })

  // 为每个空闲工作者分配最合适的任务
  let taskIndex = 0
  for (const worker of idleWorkers) {
    if (taskIndex >= sortedTasks.length) break

    const task = sortedTasks[taskIndex]

    // 检查工作者是否适合处理这个任务（避免重复分配给之前失败的工作者）
    if (task.lastFailedWorker === worker.id && sortedTasks.length > idleWorkers.length) {
      // 尝试找下一个任务
      let nextIndex = taskIndex + 1
      while (nextIndex < sortedTasks.length && nextIndex < taskIndex + idleWorkers.length) {
        if (sortedTasks[nextIndex].lastFailedWorker !== worker.id) {
          assignTaskToWorker(sortedTasks[nextIndex], worker)
          break
        }
        nextIndex++
      }
      if (nextIndex >= sortedTasks.length || nextIndex >= taskIndex + idleWorkers.length) {
        // 没有其他合适的任务，还是分配这个
        assignTaskToWorker(task, worker)
      }
    } else {
      assignTaskToWorker(task, worker)
    }

    taskIndex++
  }

  log(
    `Scheduled tasks: ${idleWorkers.length} workers, ${pendingTasks.size} remaining (retry tasks: ${Array.from(pendingTasks.values()).filter(t => t.retryCount > 0).length})`
  )
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

    // 恢复工作者健康状态
    if (worker.consecutiveFailures > 0) {
      worker.consecutiveFailures = 0
      worker.healthStatus = 'healthy'
      log(`Worker ${workerId} health restored after successful task`)
    }
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

    // 更新工作者健康状态
    worker.consecutiveFailures = (worker.consecutiveFailures || 0) + 1
    worker.lastFailureTime = Date.now()

    // 如果工作者连续失败太多，暂时降低其优先级
    if (worker.consecutiveFailures >= 3) {
      worker.healthStatus = 'unhealthy'
      worker.cooldownUntil = Date.now() + worker.consecutiveFailures * 10000 // 10 秒 * 连续失败次数
      log(
        `Worker ${workerId} marked as unhealthy, cooldown until ${new Date(worker.cooldownUntil)}`
      )
    }
  }

  task.retryCount++
  task.lastFailedWorker = workerId
  task.lastFailureTime = Date.now()

  log(`Task ${taskId} failed (attempt ${task.retryCount}) by worker ${workerId}: ${error}`)

  // 智能重试逻辑
  const maxRetries = Math.min(3 + Math.floor(task.retryCount / 2), 8) // 动态调整最大重试次数

  if (task.retryCount < maxRetries) {
    task.status = 'pending'
    task.assignedWorker = null
    activeTasks.delete(taskId)
    pendingTasks.set(taskId, task)

    // 根据错误类型调整重试延迟
    let retryDelay = 1000 // 基础延迟1秒
    if (error.includes('429') || error.includes('rate limit')) {
      retryDelay = 5000 * task.retryCount // 速率限制错误，延迟更长
    } else if (error.includes('timeout') || error.includes('network')) {
      retryDelay = 2000 * task.retryCount // 网络错误
    }

    task.retryAfter = Date.now() + retryDelay
    log(`Task ${taskId} queued for retry #${task.retryCount}, delay ${retryDelay}ms`)
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
        attempts: task.retryCount,
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

function handleBinaryMessage(ws, clientId, buffer) {
  try {
    // 支持两种二进制协议：
    // 1. 客户端协议：[4 字节 taskId 长度][taskId 字符串][文件数据]
    // 2. 服务器协议：[类型 (1 字节)][会话 ID(UUID)][任务 ID(UUID)][文件名长度 (2 字节)][文件名][MIME 类型长度 (2 字节)][MIME 类型][文件数据]

    // 确保我们有一个 Buffer 对象（ws 库可能传递 Buffer 或 ArrayBuffer）
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

    if (buf.length < 4) {
      log(`Binary message too short from ${clientId}`)
      return
    }

    // 使用 Buffer 的 readUInt32BE 方法读取前4字节（大端序）
    const potentialTaskIdLength = buf.readUInt32BE(0)

    // 如果是合理的taskId长度（通常小于100），使用客户端协议
    if (
      potentialTaskIdLength > 0 &&
      potentialTaskIdLength < 100 &&
      buf.length >= 4 + potentialTaskIdLength
    ) {
      handleClientBinaryFrame(ws, clientId, buf)
    } else {
      // 尝试服务器协议
      handleServerBinaryFrame(ws, clientId, buf)
    }
  } catch (error) {
    log(`Error handling binary message from ${clientId}: ${error.message}`)
  }
}

function handleClientBinaryFrame(ws, clientId, buffer) {
  // 客户端协议：[4 字节 taskId 长度][taskId 字符串][文件数据]
  // 确保是 Buffer 类型
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const taskIdLength = buf.readUInt32BE(0)

  const taskId = buf.subarray(4, 4 + taskIdLength).toString('utf8')

  const fileData = buf.subarray(4 + taskIdLength)

  log(`Received client binary frame: taskId=${taskId}, size=${fileData.length}`)

  // 查找等待二进制数据的任务
  const task = pendingTasks.get(taskId)
  if (task && task.status === 'waiting_binary') {
    // 将二进制数据附加到任务
    task.binaryData = fileData
    task.size = fileData.length
    task.status = 'pending' // 现在可以调度了
    log(`Task ${taskId} received binary data, ready for scheduling`)

    // 触发调度
    scheduleNextTask()
  } else if (task) {
    log(`Task ${taskId} already has data or is in wrong state: ${task.status}`)
  } else {
    // 任务还没创建，先缓存二进制数据
    if (!ws.pendingBinaryData) {
      ws.pendingBinaryData = new Map()
    }
    ws.pendingBinaryData.set(taskId, fileData)
    log(`Task ${taskId} not found, caching binary data`)
  }
}

function handleServerBinaryFrame(ws, clientId, buffer) {
  // 服务器协议：[类型 (1 字节)][会话 ID(UUID)][任务 ID(UUID)][文件名长度 (2 字节)][文件名][MIME 类型长度 (2 字节)][MIME 类型][文件数据]
  // 确保是 Buffer 类型
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  if (buf.length < 1 + 32 + 32 + 2 + 2) {
    log(`Binary message too short for server protocol from ${clientId}`)
    return
  }

  const messageType = buf.readUInt8(0)
  const sessionId = buf.subarray(1, 33).toString('hex')
  const taskId = buf.subarray(33, 65).toString('hex')

  let offset = 65
  const filenameLength = buf.readUInt16BE(offset)
  offset += 2

  if (buf.length < offset + filenameLength) {
    log(`Invalid filename length in binary message from ${clientId}`)
    return
  }

  const filename = buf.subarray(offset, offset + filenameLength).toString('utf8')
  offset += filenameLength

  const mimeTypeLength = buf.readUInt16BE(offset)
  offset += 2

  if (buf.length < offset + mimeTypeLength) {
    log(`Invalid MIME type length in binary message from ${clientId}`)
    return
  }

  const mimeType = buf.subarray(offset, offset + mimeTypeLength).toString('utf8')
  offset += mimeTypeLength

  const binaryData = buf.subarray(offset)

  // 处理二进制任务提交
  if (messageType === 0x01) {
    // 任务提交
    const session = sessions.get(sessionId)
    if (!session) {
      log(`Session ${sessionId} not found for binary task from ${clientId}`)
      return
    }

    const taskData = {
      filename,
      mimeType,
      binaryData,
      size: binaryData.length
    }

    const validation = validateTaskData(taskData)
    if (!validation.valid) {
      log(`Invalid binary task data: ${validation.error}`)
      return
    }

    const task = {
      id: taskId,
      sessionId: sessionId,
      filename: filename,
      mimeType: mimeType,
      dataBase64: null,
      binaryData: binaryData,
      size: binaryData.length,
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

    log(`Binary task submitted: ${filename} (${binaryData.length} bytes)`)

    // 通知主控端任务已提交
    sendToClient(session.ws, {
      type: 'TASK_SUBMITTED',
      taskId: task.id,
      filename: task.filename,
      size: task.size
    })

    // 开始调度
    scheduleNextTask()
  }
}

function handleMessage(ws, clientId, message) {
  try {
    // Check if message is valid JSON string
    if (typeof message !== 'string') {
      log(`Invalid message type from ${clientId}: expected string, got ${typeof message}`)
      return
    }

    // Trim whitespace and check if empty
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      log(`Empty message received from ${clientId}`)
      return
    }

    // Check for common JSON format issues
    if (!trimmedMessage.startsWith('{') || !trimmedMessage.endsWith('}')) {
      log(`Malformed JSON from ${clientId}: ${trimmedMessage.substring(0, 50)}...`)
      return
    }

    const data = JSON.parse(trimmedMessage)

    // Validate message structure
    if (!data || typeof data !== 'object') {
      log(`Invalid message structure from ${clientId}: not an object`)
      return
    }

    if (!data.type || typeof data.type !== 'string') {
      log(`Missing or invalid message type from ${clientId}`)
      return
    }

    switch (data.type) {
      // 工作者注册
      case 'WORKER_REGISTER': {
        ws.clientType = 'worker'
        const worker = {
          id: clientId,
          ws,
          status: 'idle',
          lastHeartbeat: Date.now(),
          currentTaskId: null,
          stats: { completed: 0, failed: 0, totalBytes: 0 },
          healthStatus: 'healthy',
          consecutiveFailures: 0,
          lastFailureTime: null,
          cooldownUntil: null
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

      // 主控端创建上传会话
      case 'CREATE_SESSION': {
        ws.clientType = 'master'
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

      // 工作者心跳
      case 'WORKER_HEARTBEAT': {
        const worker = workers.get(clientId)
        if (worker) {
          worker.lastHeartbeat = Date.now()
        }
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
        const binaryMode = data.binaryMode === true // 是否使用二进制模式
        let validTasks = 0
        let invalidTasks = 0

        for (const taskData of tasks) {
          const validation = validateTaskData(taskData, binaryMode)
          if (!validation.valid) {
            log(`Invalid task data: ${validation.error}`)
            invalidTasks++

            // 通知主控端任务无效
            sendToClient(ws, {
              type: 'TASK_FAILED',
              taskId: 'invalid',
              filename: taskData.filename || 'unknown',
              error: validation.error,
              progress: {
                completed: session.completedTasks,
                failed: session.failedTasks + invalidTasks,
                total: session.totalTasks + validTasks + invalidTasks
              }
            })
            continue
          }

          const task = {
            id: taskData.taskId || randomUUID(), // 客户端可能提供taskId
            sessionId: data.sessionId,
            filename: taskData.filename,
            mimeType: taskData.mimeType,
            dataBase64: taskData.dataBase64 || null,
            binaryData: taskData.binaryData || null,
            size: taskData.size || (taskData.binaryData ? taskData.binaryData.length : 0),
            status: binaryMode ? 'waiting_binary' : 'pending', // 二进制模式需要等待数据
            assignedWorker: null,
            resultUrl: null,
            error: null,
            retryCount: 0,
            createdAt: Date.now(),
            binaryMode: binaryMode // 标记是否为二进制模式
          }

          // 检查是否有预先缓存的二进制数据（修复网络延迟导致数据丢失的问题）
          if (binaryMode && ws.pendingBinaryData && ws.pendingBinaryData.has(task.id)) {
            const cachedData = ws.pendingBinaryData.get(task.id)
            if (cachedData) {
              task.binaryData = cachedData
              task.size = cachedData.length
              task.status = 'pending' // 数据已准备好，可以直接调度
              ws.pendingBinaryData.delete(task.id)
              log(`Restored cached binary data for task ${task.id}`)
            }
          }

          pendingTasks.set(task.id, task)
          session.taskIds.push(task.id)
          session.totalTasks++
          validTasks++

          // 如果任务状态是 pending（数据已准备好），触发调度
          if (task.status === 'pending') {
            scheduleNextTask()
          }
        }

        log(
          `Session ${data.sessionId}: ${tasks.length} tasks submitted (binaryMode: ${binaryMode}, valid: ${validTasks}, invalid: ${invalidTasks})`
        )

        sendToClient(ws, {
          type: 'TASKS_SUBMITTED',
          sessionId: data.sessionId,
          taskCount: tasks.length,
          totalPending: pendingTasks.size,
          binaryMode: binaryMode
        })

        // 非二进制模式立即开始调度
        if (!binaryMode) {
          scheduleNextTask()
        }
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
    if (error instanceof SyntaxError) {
      log(`JSON parsing error from ${clientId}: ${error.message}`)
      log(`Problematic message: ${message.toString().substring(0, 200)}...`)

      // Send error feedback to client
      sendToClient(ws, {
        type: 'ERROR',
        message: 'Invalid JSON format',
        code: 'JSON_PARSE_ERROR'
      })
    } else {
      log(`Error handling message from ${clientId}: ${error.message}`)
      log(`Stack trace: ${error.stack}`)

      // Send generic error to client
      sendToClient(ws, {
        type: 'ERROR',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}

function handleDisconnect(clientId) {
  // 查找对应的WebSocket连接
  let ws = null
  let clientType = 'unknown'

  for (const worker of workers.values()) {
    if (worker.id === clientId) {
      ws = worker.ws
      clientType = 'worker'
      break
    }
  }

  if (!ws) {
    for (const session of sessions.values()) {
      if (session.ws.clientId === clientId) {
        ws = session.ws
        clientType = 'master'
        break
      }
    }
  }

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

  // 清理WebSocket相关数据
  if (ws) {
    ws.pendingBinaryData?.clear()
    ws.clientType = 'unknown'
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

wss.on('connection', ws => {
  const clientId = randomUUID()
  ws.clientId = clientId
  ws.clientType = 'unknown' // 将在首次消息时确定
  ws.pendingBinaryData = new Map() // 用于存储待处理的二进制数据

  log(`Client connected: ${clientId}`)

  ws.on('message', (message, isBinary) => {
    try {
      if (isBinary) {
        // 二进制消息 - 可能包含文件数据
        handleBinaryMessage(ws, clientId, message)
      } else {
        // 文本消息 - JSON 格式
        const messageStr = message.toString()
        handleMessage(ws, clientId, messageStr)
      }
    } catch (error) {
      log(`Error processing message from ${clientId}: ${error.message}`)
    }
  })

  ws.on('close', () => {
    handleDisconnect(clientId)
  })

  ws.on('error', error => {
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

    // 恢复冷却期的工作者
    if (
      worker.healthStatus === 'unhealthy' &&
      worker.cooldownUntil &&
      now >= worker.cooldownUntil
    ) {
      worker.healthStatus = 'healthy'
      worker.cooldownUntil = null
      log(`Worker ${id} cooldown ended, health restored`)
    }
  }

  // 检查超时任务 (5 分钟)
  for (const [id, task] of activeTasks.entries()) {
    if (now - task.createdAt > 5 * 60 * 1000) {
      log(`Task ${id} timeout`)
      handleTaskFailed(task.assignedWorker, id, 'Task timeout')
    }
  }

  // 检查是否有延迟的重试任务可以调度
  let hasDelayedTasks = false
  for (const [id, task] of pendingTasks.entries()) {
    if (task.retryAfter && now >= task.retryAfter) {
      hasDelayedTasks = true
      break
    }
  }

  if (hasDelayedTasks) {
    scheduleNextTask()
  }
}, 10000)

server.listen(PORT, () => {
  log(`===========================================`)
  log(`  联动上传协调服务器已启动`)
  log(`  WebSocket: ws://localhost:${PORT}`)
  log(`  状态页面：http://localhost:${PORT}`)
  log(`===========================================`)
})
