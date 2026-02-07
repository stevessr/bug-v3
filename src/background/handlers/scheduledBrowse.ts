import { getChromeAPI } from '../utils/main'

import * as storage from '@/utils/simpleStorage'
import type { ScheduledBrowseTask, BrowseStrategy } from '@/types/type'

const SCHEDULED_BROWSE_ALARM_NAME = 'scheduled-browse-check'
const CHECK_INTERVAL_MINUTES = 1

interface TopicListItem {
  id: number
  title: string
  slug: string
  posts_count: number
  views: number
  like_count: number
  created_at: string
  last_posted_at: string
}

interface TopicListResponse {
  topic_list: {
    topics: TopicListItem[]
  }
}

interface TopicDetail {
  id: number
  post_stream: {
    posts: Array<{
      id: number
      post_number: number
      cooked: string
      actions_summary?: Array<{ id: number; acted?: boolean }>
      current_user_reaction?: string
    }>
  }
}

// 获取随机数
const randomBetween = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 获取话题列表
async function fetchTopicList(baseUrl: string, strategy: BrowseStrategy): Promise<TopicListItem[]> {
  const endpoints: Record<BrowseStrategy, string> = {
    latest: '/latest.json',
    new: '/new.json',
    unread: '/unread.json',
    top: '/top.json'
  }

  const url = `${baseUrl}${endpoints[strategy]}`

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`获取话题列表失败：${response.status}`)
  }

  const data: TopicListResponse = await response.json()
  return data.topic_list?.topics || []
}

// 获取话题详情（模拟阅读）
async function fetchTopicDetail(baseUrl: string, topicId: number): Promise<TopicDetail | null> {
  const url = `${baseUrl}/t/${topicId}.json`

  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) return null

    return await response.json()
  } catch {
    return null
  }
}

// 发送阅读时间（Discourse 计时）
async function sendTimings(
  baseUrl: string,
  topicId: number,
  postNumbers: number[],
  readTime: number
): Promise<void> {
  const timings: Record<string, number> = {}
  postNumbers.forEach(pn => {
    timings[String(pn)] = readTime * 1000 // 毫秒
  })

  const url = `${baseUrl}/topics/timings`

  try {
    await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      },
      body: new URLSearchParams({
        topic_id: String(topicId),
        topic_time: String(readTime * 1000),
        timings: JSON.stringify(timings)
      }).toString()
    })
  } catch {
    // 忽略错误
  }
}

// 点赞帖子
async function likePost(baseUrl: string, postId: number): Promise<boolean> {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/heart/toggle.json`

  try {
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
  } catch {
    return false
  }
}

// 检查帖子是否已点赞
function isPostLiked(post: TopicDetail['post_stream']['posts'][number]): boolean {
  if (post.current_user_reaction) return true
  if (Array.isArray(post.actions_summary)) {
    const likeAction = post.actions_summary.find(a => a.id === 2)
    if (likeAction?.acted) return true
  }
  return false
}

// 执行单个浏览任务
async function executeBrowseTask(
  task: ScheduledBrowseTask
): Promise<{ topicsRead: number; liked: number; errors: string[] }> {
  const errors: string[] = []
  let topicsRead = 0
  let liked = 0
  let likesRemaining = task.maxLikesPerRun

  try {
    // 获取话题列表
    const topics = await fetchTopicList(task.baseUrl, task.browseStrategy)

    if (topics.length === 0) {
      errors.push('没有找到话题')
      return { topicsRead, liked, errors }
    }

    // 确定要浏览的话题数量
    const topicsToRead = randomBetween(task.minTopicsPerRun, task.maxTopicsPerRun)
    const selectedTopics = topics.slice(0, Math.min(topicsToRead, topics.length))

    console.log(`[ScheduledBrowse] 将浏览 ${selectedTopics.length} 个话题`)

    for (const topic of selectedTopics) {
      try {
        // 获取话题详情
        const detail = await fetchTopicDetail(task.baseUrl, topic.id)
        if (!detail) {
          errors.push(`话题 ${topic.id} 获取失败`)
          continue
        }

        // 计算阅读时间
        const readTime = randomBetween(task.minReadTime, task.maxReadTime)

        // 获取帖子编号
        const postNumbers = detail.post_stream.posts.map(p => p.post_number)

        // 模拟阅读延迟
        await delay(readTime * 1000)

        // 发送阅读时间
        await sendTimings(task.baseUrl, topic.id, postNumbers, readTime)

        topicsRead++
        console.log(`[ScheduledBrowse] 已阅读话题 ${topic.id}: ${topic.title}`)

        // 随机点赞
        if (task.enableRandomLike && likesRemaining > 0) {
          const shouldLike = Math.random() * 100 < task.likeChance

          if (shouldLike) {
            // 找一个未点赞的帖子
            const unlikedPost = detail.post_stream.posts.find(p => !isPostLiked(p))

            if (unlikedPost) {
              const success = await likePost(task.baseUrl, unlikedPost.id)
              if (success) {
                liked++
                likesRemaining--
                console.log(`[ScheduledBrowse] 已点赞帖子 ${unlikedPost.id}`)
              }
            }
          }
        }

        // 话题间延迟
        if (selectedTopics.indexOf(topic) < selectedTopics.length - 1) {
          const topicDelay = randomBetween(
            task.minDelayBetweenTopics * 1000,
            task.maxDelayBetweenTopics * 1000
          )
          await delay(topicDelay)
        }
      } catch (err) {
        errors.push(`话题 ${topic.id}: ${err instanceof Error ? err.message : '未知错误'}`)
      }
    }
  } catch (err) {
    errors.push(`获取话题列表失败: ${err instanceof Error ? err.message : '未知错误'}`)
  }

  return { topicsRead, liked, errors }
}

// 检查并执行到期的任务
async function checkAndExecuteBrowseTasks() {
  console.log('[ScheduledBrowse] 检查自动浏览任务...')

  try {
    const settings = await storage.getSettings()
    if (!settings?.enableScheduledBrowse) {
      return
    }

    const tasks = settings.scheduledBrowseTasks || []
    const now = Date.now()
    let updated = false

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      if (!task.enabled) continue
      if (task.nextRunAt && task.nextRunAt > now) continue

      console.log(`[ScheduledBrowse] 执行任务：${task.name}`)

      const result = await executeBrowseTask(task)

      tasks[i] = {
        ...task,
        lastRunAt: now,
        nextRunAt: now + task.intervalMinutes * 60 * 1000,
        totalTopicsRead: task.totalTopicsRead + result.topicsRead,
        totalLikes: task.totalLikes + result.liked,
        updatedAt: now
      }
      updated = true

      if (result.errors.length > 0) {
        console.warn(`[ScheduledBrowse] 任务 ${task.name} 有错误:`, result.errors)
      }

      console.log(
        `[ScheduledBrowse] 任务 ${task.name} 完成，浏览 ${result.topicsRead} 个话题，点赞 ${result.liked} 次`
      )
    }

    if (updated) {
      await storage.setSettings({
        ...settings,
        scheduledBrowseTasks: tasks
      })
    }
  } catch (err) {
    console.error('[ScheduledBrowse] 检查任务失败：', err)
  }
}

export function setupScheduledBrowse() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.alarms) {
    console.warn('[ScheduledBrowse] chrome.alarms API 不可用')
    return
  }

  chromeAPI.alarms.create(SCHEDULED_BROWSE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  })

  chromeAPI.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== SCHEDULED_BROWSE_ALARM_NAME) return
    await checkAndExecuteBrowseTasks()
  })

  console.log('[ScheduledBrowse] 自动浏览任务检查器已启动')
}

export function cleanupScheduledBrowse() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.alarms) {
    chromeAPI.alarms.clear(SCHEDULED_BROWSE_ALARM_NAME)
    console.log('[ScheduledBrowse] 自动浏览任务检查器已停止')
  }
}
