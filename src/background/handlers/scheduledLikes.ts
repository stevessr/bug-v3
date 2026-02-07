import { getChromeAPI } from '../utils/main'

import * as storage from '@/utils/simpleStorage'
import type { ScheduledLikeTask } from '@/types/type'

const SCHEDULED_LIKES_ALARM_NAME = 'scheduled-likes-check'
const CHECK_INTERVAL_MINUTES = 1 // 每分钟检查一次

interface UserActivity {
  post_id: number
  post_number: number
  topic_id: number
  topic_title?: string
  created_at: string
  action_type: number
}

interface UserActivityResponse {
  user_actions: UserActivity[]
}

// 获取用户最近活动（帖子）
async function fetchUserActivity(baseUrl: string, username: string): Promise<UserActivity[]> {
  const url = `${baseUrl}/user_actions.json?username=${encodeURIComponent(username)}&filter=4,5&limit=20`

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`获取用户活动失败：${response.status}`)
  }

  const data: UserActivityResponse = await response.json()
  return data.user_actions || []
}

// 对帖子点赞
async function likePost(baseUrl: string, postId: number): Promise<boolean> {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/heart/toggle.json`

  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })

  return response.ok
}

// 检查帖子是否已点赞
async function checkPostLiked(baseUrl: string, postId: number): Promise<boolean> {
  const url = `${baseUrl}/posts/${postId}.json`

  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) return false

    const data = await response.json()
    // 检查当前用户是否已点赞
    if (data.current_user_reaction) {
      return true
    }
    // 或者检查 actions_summary
    if (Array.isArray(data.actions_summary)) {
      const likeAction = data.actions_summary.find((a: any) => a.id === 2)
      if (likeAction && likeAction.acted) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

// 执行单个任务
async function executeTask(task: ScheduledLikeTask): Promise<{ liked: number; errors: string[] }> {
  const errors: string[] = []
  let liked = 0

  try {
    // 获取用户最近活动
    const activities = await fetchUserActivity(task.baseUrl, task.username)

    // 过滤出帖子（action_type 4=点赞，5=回复）
    const postIds = [...new Set(activities.map(a => a.post_id))]

    // 限制每次点赞数量
    const postsToLike = postIds.slice(0, task.maxLikesPerRun)

    for (const postId of postsToLike) {
      try {
        // 检查是否已点赞
        const alreadyLiked = await checkPostLiked(task.baseUrl, postId)
        if (alreadyLiked) {
          continue
        }

        // 点赞
        const success = await likePost(task.baseUrl, postId)
        if (success) {
          liked++
          console.log(`[ScheduledLikes] 成功点赞帖子 ${postId}`)
        } else {
          errors.push(`帖子 ${postId} 点赞失败`)
        }

        // 添加随机延迟（1-3 秒），避免触发限流
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
      } catch (err) {
        errors.push(`帖子 ${postId}: ${err instanceof Error ? err.message : '未知错误'}`)
      }
    }
  } catch (err) {
    errors.push(`获取用户活动失败：${err instanceof Error ? err.message : '未知错误'}`)
  }

  return { liked, errors }
}

// 检查并执行到期的任务
async function checkAndExecuteTasks() {
  console.log('[ScheduledLikes] 检查计划任务...')

  try {
    const settings = await storage.getSettings()
    if (!settings?.enableScheduledLikes) {
      return
    }

    const tasks = settings.scheduledLikeTasks || []
    const now = Date.now()
    let updated = false

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      // 跳过禁用的任务
      if (!task.enabled) continue

      // 检查是否到达执行时间
      if (task.nextRunAt && task.nextRunAt > now) continue

      console.log(`[ScheduledLikes] 执行任务：@${task.username}`)

      const result = await executeTask(task)

      // 更新任务状态
      tasks[i] = {
        ...task,
        lastRunAt: now,
        nextRunAt: now + task.intervalMinutes * 60 * 1000,
        totalLikes: task.totalLikes + result.liked,
        updatedAt: now
      }
      updated = true

      if (result.errors.length > 0) {
        console.warn(`[ScheduledLikes] 任务 @${task.username} 有错误:`, result.errors)
      }

      console.log(`[ScheduledLikes] 任务 @${task.username} 完成，点赞 ${result.liked} 个帖子`)
    }

    // 保存更新后的任务列表
    if (updated) {
      await storage.setSettings({
        ...settings,
        scheduledLikeTasks: tasks
      })
    }
  } catch (err) {
    console.error('[ScheduledLikes] 检查任务失败：', err)
  }
}

// 设置定时检查
export function setupScheduledLikes() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.alarms) {
    console.warn('[ScheduledLikes] chrome.alarms API 不可用')
    return
  }

  // 创建定时器
  chromeAPI.alarms.create(SCHEDULED_LIKES_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  })

  // 监听定时器
  chromeAPI.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== SCHEDULED_LIKES_ALARM_NAME) return
    await checkAndExecuteTasks()
  })

  console.log('[ScheduledLikes] 计划任务检查器已启动')
}

// 清理定时器
export function cleanupScheduledLikes() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.alarms) {
    chromeAPI.alarms.clear(SCHEDULED_LIKES_ALARM_NAME)
    console.log('[ScheduledLikes] 计划任务检查器已停止')
  }
}

// 手动触发任务执行（用于测试）
export async function triggerScheduledLikesCheck() {
  await checkAndExecuteTasks()
}
