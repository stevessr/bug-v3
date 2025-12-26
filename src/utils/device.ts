/**
 * 设备标识工具
 * 生成和管理唯一的设备 ID
 */

import { nanoid } from 'nanoid'

import { safeLocalStorage } from './safeStorage'

const DEVICE_ID_KEY = 'emoji_extension_device_id'
const DEVICE_INFO_KEY = 'emoji_extension_device_info'

/**
 * 获取或生成设备 ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    // 尝试从 Chrome Storage 获取
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.local) {
      const result = await new Promise<any>(resolve => {
        chromeAPI.storage.local.get([DEVICE_ID_KEY], (r: any) => resolve(r))
      })

      if (result[DEVICE_ID_KEY]) {
        return result[DEVICE_ID_KEY]
      }
    }

    // 尝试从 localStorage 获取
    if (typeof localStorage !== 'undefined') {
      const stored = safeLocalStorage.get(DEVICE_ID_KEY, null)
      if (stored) return stored
    }

    // 生成新的设备 ID
    const newId = `device_${nanoid(16)}`

    // 保存到存储
    if (chromeAPI?.storage?.local) {
      await new Promise(resolve => {
        chromeAPI.storage.local.set({ [DEVICE_ID_KEY]: newId }, () => resolve(undefined))
      })
    }

    if (typeof localStorage !== 'undefined') {
      safeLocalStorage.set(DEVICE_ID_KEY, newId)
    }

    return newId
  } catch (error) {
    console.error('[Device] Failed to get/generate device ID:', error)
    // 降级方案：使用时间戳和随机数
    return `device_fallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
}

/**
 * 获取设备信息
 */
export async function getDeviceInfo(): Promise<{
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  userAgent: string
  platform: string
}> {
  const deviceId = await getDeviceId()

  // 检测设备类型
  const ua = navigator.userAgent
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'

  if (/Mobile|Android|iP(hone|od)/.test(ua)) {
    deviceType = 'mobile'
  } else if (/iPad|Tablet/.test(ua)) {
    deviceType = 'tablet'
  }

  // 生成设备名称
  let deviceName = 'Unknown Device'
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform || ''
    if (platform.includes('Win')) deviceName = 'Windows Device'
    else if (platform.includes('Mac')) deviceName = 'Mac Device'
    else if (platform.includes('Linux')) deviceName = 'Linux Device'
    else if (platform.includes('iPhone')) deviceName = 'iPhone'
    else if (platform.includes('iPad')) deviceName = 'iPad'
    else if (platform.includes('Android')) deviceName = 'Android Device'
  }

  return {
    id: deviceId,
    name: deviceName,
    type: deviceType,
    userAgent: ua,
    platform: navigator.platform || 'unknown'
  }
}

/**
 * 保存设备信息
 */
export async function saveDeviceInfo(info: any): Promise<void> {
  try {
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.local) {
      await new Promise(resolve => {
        chromeAPI.storage.local.set({ [DEVICE_INFO_KEY]: info }, () => resolve(undefined))
      })
    }

    if (typeof localStorage !== 'undefined') {
      safeLocalStorage.set(DEVICE_INFO_KEY, info)
    }
  } catch (error) {
    console.error('[Device] Failed to save device info:', error)
  }
}

/**
 * 加载设备信息
 */
export async function loadDeviceInfo(): Promise<any> {
  try {
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.local) {
      const result = await new Promise<any>(resolve => {
        chromeAPI.storage.local.get([DEVICE_INFO_KEY], (r: any) => resolve(r))
      })

      if (result[DEVICE_INFO_KEY]) {
        return result[DEVICE_INFO_KEY]
      }
    }

    if (typeof localStorage !== 'undefined') {
      const stored = safeLocalStorage.get<any>(DEVICE_INFO_KEY, null)
      if (stored) return stored
    }

    return null
  } catch (error) {
    console.error('[Device] Failed to load device info:', error)
    return null
  }
}
