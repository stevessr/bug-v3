import { getChromeAPI } from '../utils/main'

import {
  ensureDiscoursePostLiked,
  fetchDiscourseTopicList,
  fetchDiscourseTopicWithPosts,
  isDiscoursePostLiked,
  normalizeDiscourseBaseUrl,
  sendDiscourseTimings
} from './discourseClient'

import * as storage from '@/utils/simpleStorage'
import type { AppSettings, ScheduledBrowseTask } from '@/types/type'

const SCHEDULED_BROWSE_ALARM_NAME = 'scheduled-browse-check'
const CHECK_INTERVAL_MINUTES = 1
const SCHEDULED_BROWSE_TOGGLE_KEY: keyof AppSettings = 'enableScheduledBrowse'
const MAX_TOPIC_POSTS_PER_RUN = 200

function randomBetween(min: number, max: number): number {
  const low = Math.min(min, max)
  const high = Math.max(min, max)
  return Math.floor(Math.random() * (high - low + 1)) + low
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function executeBrowseTask(
  task: ScheduledBrowseTask
): Promise<{ topicsRead: number; liked: number; errors: string[] }> {
  const errors: string[] = []
  let topicsRead = 0
  let liked = 0
  let likesRemaining = Math.max(0, task.maxLikesPerRun)
  const baseUrl = normalizeDiscourseBaseUrl(task.baseUrl)

  try {
    const topicList = await fetchDiscourseTopicList(baseUrl, task.browseStrategy)
    const topics = Array.isArray(topicList?.topic_list?.topics) ? topicList.topic_list.topics : []

    if (topics.length === 0) {
      errors.push('没有找到话题')
      return { topicsRead, liked, errors }
    }

    const topicsToRead = randomBetween(task.minTopicsPerRun, task.maxTopicsPerRun)
    const selectedTopics = topics.slice(0, Math.min(topicsToRead, topics.length))
    console.log(`[ScheduledBrowse] 将浏览 ${selectedTopics.length} 个话题`)

    for (let index = 0; index < selectedTopics.length; index++) {
      const topic = selectedTopics[index]
      try {
        const detail = await fetchDiscourseTopicWithPosts(baseUrl, Number(topic.id), {
          maxPosts: MAX_TOPIC_POSTS_PER_RUN
        })
        if (detail.posts.length === 0) {
          errors.push(`话题 ${topic.id} 没有可读取的帖子`)
          continue
        }

        const readTimeSeconds = randomBetween(task.minReadTime, task.maxReadTime)
        const readTimeMs = Math.max(1000, readTimeSeconds * 1000)
        const postNumbers = detail.posts
          .map((post: any) => Number(post.post_number))
          .filter((postNumber: number) => Number.isFinite(postNumber) && postNumber > 0)

        await delay(readTimeMs)

        try {
          await sendDiscourseTimings(baseUrl, Number(topic.id), postNumbers, readTimeMs)
        } catch (error) {
          errors.push(
            `话题 ${topic.id} 阅读计时上报失败: ${error instanceof Error ? error.message : '未知错误'}`
          )
        }

        topicsRead++
        console.log(
          `[ScheduledBrowse] 已阅读话题 ${topic.id}: ${topic.title}（加载 ${detail.posts.length}/${detail.stream.length} 帖）`
        )

        if (task.enableRandomLike && likesRemaining > 0 && Math.random() * 100 < task.likeChance) {
          const unlikedPost = detail.posts.find((post: any) => !isDiscoursePostLiked(post))
          if (unlikedPost?.id) {
            try {
              const result = await ensureDiscoursePostLiked(
                baseUrl,
                Number(unlikedPost.id),
                'heart'
              )
              if (result.liked && !result.alreadyLiked) {
                liked++
                likesRemaining--
                console.log(`[ScheduledBrowse] 已点赞帖子 ${unlikedPost.id}`)
              }
            } catch (error) {
              errors.push(
                `话题 ${topic.id} 点赞失败: ${error instanceof Error ? error.message : '未知错误'}`
              )
            }
          }
        }

        if (index < selectedTopics.length - 1) {
          const topicDelay = randomBetween(
            task.minDelayBetweenTopics * 1000,
            task.maxDelayBetweenTopics * 1000
          )
          await delay(topicDelay)
        }
      } catch (error) {
        errors.push(`话题 ${topic.id}: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  } catch (error) {
    errors.push(`获取话题列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }

  return { topicsRead, liked, errors }
}

let isCheckingScheduledBrowse = false

async function checkAndExecuteBrowseTasks() {
  if (isCheckingScheduledBrowse) {
    console.log('[ScheduledBrowse] 上一轮检查仍在执行，跳过本次触发')
    return
  }

  isCheckingScheduledBrowse = true
  console.log('[ScheduledBrowse] 检查自动浏览任务...')

  try {
    const settings = await storage.getSettings()
    if (!settings?.enableScheduledBrowse) return

    const tasks = settings.scheduledBrowseTasks || []
    let updated = false

    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index]
      const now = Date.now()
      if (!task.enabled) continue
      if (task.nextRunAt && task.nextRunAt > now) continue

      console.log(`[ScheduledBrowse] 执行任务：${task.name}`)
      const result = await executeBrowseTask(task)
      const completedAt = Date.now()

      tasks[index] = {
        ...task,
        lastRunAt: completedAt,
        nextRunAt: completedAt + Math.max(1, task.intervalMinutes) * 60 * 1000,
        totalTopicsRead: task.totalTopicsRead + result.topicsRead,
        totalLikes: task.totalLikes + result.liked,
        updatedAt: completedAt
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
      await storage.setSettings({ ...settings, scheduledBrowseTasks: tasks })
    }
  } catch (error) {
    console.error('[ScheduledBrowse] 检查任务失败：', error)
  } finally {
    isCheckingScheduledBrowse = false
  }
}

async function syncScheduledBrowseAlarm() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.alarms) {
    console.warn('[ScheduledBrowse] chrome.alarms API 不可用')
    return
  }

  const settings = await storage.getSettings()
  const enabled = Boolean(settings?.enableScheduledBrowse)

  if (!enabled) {
    await chromeAPI.alarms.clear(SCHEDULED_BROWSE_ALARM_NAME)
    console.log('[ScheduledBrowse] 功能未启用，已清理定时器')
    return
  }

  chromeAPI.alarms.create(SCHEDULED_BROWSE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  })
  console.log('[ScheduledBrowse] 自动浏览任务检查器已启动')
}

export function setupScheduledBrowse() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.alarms) {
    console.warn('[ScheduledBrowse] chrome.alarms API 不可用')
    return
  }

  chromeAPI.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== SCHEDULED_BROWSE_ALARM_NAME) return
    await checkAndExecuteBrowseTasks()
  })

  chromeAPI.storage?.onChanged?.addListener(
    (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      if (namespace !== 'local' || !changes.appSettings) return

      const oldRaw = changes.appSettings.oldValue as { data?: AppSettings } | undefined
      const newRaw = changes.appSettings.newValue as { data?: AppSettings } | undefined
      const oldEnabled = Boolean(oldRaw?.data?.[SCHEDULED_BROWSE_TOGGLE_KEY])
      const newEnabled = Boolean(newRaw?.data?.[SCHEDULED_BROWSE_TOGGLE_KEY])

      if (oldEnabled !== newEnabled) void syncScheduledBrowseAlarm()
    }
  )

  void syncScheduledBrowseAlarm()
}

export function cleanupScheduledBrowse() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.alarms) {
    chromeAPI.alarms.clear(SCHEDULED_BROWSE_ALARM_NAME)
    console.log('[ScheduledBrowse] 自动浏览任务检查器已停止')
  }
}
