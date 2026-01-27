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

/**
 * 检测当前页面属于哪个平台
 */
export function detectPlatform(): PlatformInfo {
  const hostname = window.location.hostname.toLowerCase()

  // Discourse detection
  if (DISCOURSE_DOMAINS.some(domain => hostname == domain)) {
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
  const hostname = window.location.hostname.toLowerCase()

  // Check if it's a known Discourse domain
  if (DISCOURSE_DOMAINS.some(domain => hostname == domain )) {
    return true
  }

  // Check for discourse meta tags
  const discourseMeta = document.querySelector(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMeta) {
    return true
  }

  // Check for common forum platforms via generator meta
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      return true
    }
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    return true
  }

  return false
}

/**
 * 获取 Discourse 域名列表（用于向后兼容）
 */
export function getDiscourseDomains(): readonly string[] {
  return DISCOURSE_DOMAINS
}
