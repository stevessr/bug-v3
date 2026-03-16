/**
 * Platform Detection Utilities
 * 用于检测当前页面所属平台，支持按需加载对应模块
 */

export type Platform =
  | 'discourse'
  | 'pixiv'
  | 'bilibili'
  | 'reddit'
  | 'x'
  | 'xhs'
  | 'tieba'
  | 'unknown'

export interface PlatformInfo {
  platform: Platform
  hostname: string
  shouldLoadModule: boolean
}

// Domain patterns for each platform
const DISCOURSE_DOMAINS = ['linux.do', 'meta.discourse.org', 'idcflare.com']
const PIXIV_DOMAINS = ['pixiv.net']
const BILIBILI_DOMAINS = ['bilibili.com', 't.bilibili.com']
const REDDIT_DOMAINS = ['reddit.com', 'redd.it']
const X_DOMAINS = ['twitter.com', 'x.com', 'twimg.com']
const XHS_DOMAINS = ['xiaohongshu', 'xhs']
const TIEBA_DOMAINS = ['tieba.baidu.com']
const DISCOURSE_GENERATOR_RE = /^discourse\b/i

export function hasDiscourseGeneratorMeta(doc: Document = document): boolean {
  const generatorMeta = doc.head?.querySelector('meta[name="generator"]') as HTMLMetaElement | null
  const content = generatorMeta?.content?.trim() || ''
  return DISCOURSE_GENERATOR_RE.test(content)
}

/**
 * 检测当前页面属于哪个平台
 */
export function detectPlatform(): PlatformInfo {
  const hostname = window.location.hostname.toLowerCase()

  // Discourse detection
  if (hasDiscourseGeneratorMeta()) {
    return {
      platform: 'discourse',
      hostname,
      shouldLoadModule: true
    }
  }

  // Pixiv detection
  if (PIXIV_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'pixiv',
      hostname,
      shouldLoadModule: true
    }
  }

  // Bilibili detection
  if (BILIBILI_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'bilibili',
      hostname,
      shouldLoadModule: true
    }
  }

  // Reddit detection
  if (REDDIT_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'reddit',
      hostname,
      shouldLoadModule: true
    }
  }

  // X (Twitter) detection
  if (X_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'x',
      hostname,
      shouldLoadModule: true
    }
  }

  // 小红书 (XHS) detection
  if (XHS_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'xhs',
      hostname,
      shouldLoadModule: true
    }
  }

  // 百度贴吧 (Tieba) detection
  if (TIEBA_DOMAINS.some(domain => hostname.includes(domain))) {
    return {
      platform: 'tieba',
      hostname,
      shouldLoadModule: true
    }
  }

  return {
    platform: 'unknown',
    hostname,
    shouldLoadModule: false
  }
}

/**
 * 检查是否应该注入表情功能（用于 Discourse 等通用平台）
 */
export function shouldInjectEmojiFeature(): boolean {
  return hasDiscourseGeneratorMeta()
}

/**
 * 获取 Discourse 域名列表（用于向后兼容）
 */
export function getDiscourseDomains(): readonly string[] {
  return DISCOURSE_DOMAINS
}
