// Entry point: 初始化模块并启动功能
import { logger } from '../config/buildFlagsV2'

import { initializeEmojiFeature } from './init'
import { Uninject } from './Uninject'

logger.log('[Emoji Extension] Content script loaded (entry)')

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tag as example
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    logger.log('[Emoji Extension] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      logger.log('[Emoji Extension] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    logger.log('[Emoji Extension] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    logger.log('[Emoji Extension] Discussion editor detected')
    return true
  }

  logger.log('[Emoji Extension] No compatible platform detected')
  return false
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  logger.log('[Emoji Extension] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  Uninject()
  logger.log('[Emoji Extension] Skipping injection - incompatible platform')
}

export {}
