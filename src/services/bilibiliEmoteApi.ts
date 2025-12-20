// Bilibili Emote API Service
// 获取bilibili表情包列表和表情数据

export interface BilibiliEmote {
  id: number
  text: string // 表情名称，如 "[微笑]"
  url: string // 表情图片URL
}

export interface BilibiliEmotePackage {
  id: number
  text: string // 表情包名称，如 "小黄脸"
  url: string // 表情包图标URL
  emote: BilibiliEmote[] // 表情列表
}

export interface BilibiliEmoteResponse {
  code: number
  message: string
  data: {
    packages: BilibiliEmotePackage[]
  }
}

/**
 * 获取bilibili用户表情包列表
 * @param business 业务场景，reply为评论区，dynamic为动态
 * @returns Promise<BilibiliEmotePackage[]>
 */
export async function fetchBilibiliEmotePackages(
  business: 'reply' | 'dynamic' = 'reply'
): Promise<BilibiliEmotePackage[]> {
  try {
    const response = await fetch(
      `https://api.bilibili.com/x/emote/user/panel/web?business=${business}`,
      {
        method: 'GET',
        credentials: 'include', // 需要包含cookie以获取用户表情
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: BilibiliEmoteResponse = await response.json()

    if (data.code !== 0) {
      throw new Error(`API error: ${data.message}`)
    }

    return data.data.packages
  } catch (error) {
    console.error('[Bilibili API] 获取表情包失败:', error)
    throw error
  }
}

/**
 * 获取bilibili所有表情包
 * @returns Promise<BilibiliEmotePackage[]>
 */
export async function fetchAllBilibiliEmotePackages(): Promise<BilibiliEmotePackage[]> {
  return await fetchBilibiliEmotePackages('reply')
}

/**
 * 将bilibili表情包转换为插件表情格式
 * @param packages bilibili表情包数组
 * @param targetGroupId 目标分组ID
 * @returns 转换后的表情数组
 */
export function convertBilibiliEmotesToPluginFormat(
  packages: BilibiliEmotePackage[],
  targetGroupId?: string
): Array<{ name: string; url: string; groupId?: string }> {
  const result: Array<{ name: string; url: string; groupId?: string }> = []

  packages.forEach(pkg => {
    pkg.emote.forEach(emote => {
      result.push({
        name: emote.text.replace(/[[]]/g, ''), // 移除方括号
        url: emote.url,
        groupId: targetGroupId || pkg.text
      })
    })
  })

  return result
}

/**
 * 通过表情包ID获取指定的表情包
 * @param packageId 表情包ID
 * @returns Promise<BilibiliEmotePackage>
 */
export async function fetchBilibiliEmotePackageById(
  packageId: number
): Promise<BilibiliEmotePackage> {
  try {
    const response = await fetch(
      `https://api.bilibili.com/x/emote/package?ids=${packageId}&business=reply`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`API error: ${data.message}`)
    }

    // 转换API响应格式为标准格式
    const packageData = data.data.packages[0]
    if (!packageData) {
      throw new Error('未找到指定的表情包')
    }

    return {
      id: packageData.id,
      text: packageData.text,
      url: packageData.url,
      emote: packageData.emote.map((emote: any) => ({
        id: emote.id,
        text: emote.text,
        url: emote.url
      }))
    }
  } catch (error) {
    console.error('[Bilibili API] 获取指定表情包失败:', error)
    throw error
  }
}
