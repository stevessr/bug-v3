// Entry point: 初始化模块并启动功能
import { initializeEmojiFeature } from './content/init'

console.log('[Mr Emoji] Content script loaded (entry)')

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tag as example
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]',
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Mr Emoji] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Mr Emoji] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some((domain) => hostname.includes(domain))) {
    console.log('[Mr Emoji] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea',
  )
  if (editors.length > 0) {
    console.log('[Mr Emoji] Discussion editor detected')
    return true
  }

  console.log('[Mr Emoji] No compatible platform detected')
  return false
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  console.log('[Mr Emoji] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  console.log('[Mr Emoji] Skipping injection - incompatible platform')
}

export {}
