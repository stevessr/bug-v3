// Manager userscript entry point - emoji management interface
// This script provides settings, import/export, and emoji management features

import { loadDataFromLocalStorage, loadDataFromLocalStorageAsync, saveDataToLocalStorage } from './userscript-storage'
import { userscriptState } from './state'
import { logPlatformInfo } from './utils/platformDetection'

// Initialize from localStorage
async function initializeUserscriptData() {
  const data = await loadDataFromLocalStorageAsync().catch((err: any) => {
    console.warn(
      '[Manager] loadDataFromLocalStorageAsync failed, falling back to sync loader',
      err
    )
    return loadDataFromLocalStorage()
  })
  userscriptState.emojiGroups = data.emojiGroups || []
  userscriptState.settings = data.settings || userscriptState.settings
}

// Function to check if current page is a Discourse site
function isDiscoursePage(): boolean {
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Manager] Discourse detected via meta tags')
    return true
  }

  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse')) {
      console.log('[Emoji Manager] Discourse detected via generator meta')
      return true
    }
  }

  const discourseElements = document.querySelectorAll(
    '#main-outlet, .ember-application, textarea.d-editor-input, .ProseMirror.d-editor-input'
  )
  if (discourseElements.length > 0) {
    console.log('[Emoji Manager] Discourse elements detected')
    return true
  }

  console.log('[Emoji Manager] Not a Discourse site')
  return false
}

// Main initialization function for manager
async function initializeEmojiManager() {
  console.log('[Emoji Manager] Initializing...')
  
  logPlatformInfo()
  await initializeUserscriptData()
  
  // Detect if we're on mobile
  const isMobile = window.innerWidth <= 768 || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase())
  
  // Create floating management button with mobile-optimized styling
  const managerButton = document.createElement('button')
  managerButton.id = 'emoji-manager-floating-button'
  managerButton.textContent = isMobile ? '⚙️' : '⚙️ 表情管理'
  managerButton.title = 'Open Emoji Management Interface'
  Object.assign(managerButton.style, {
    position: 'fixed',
    right: isMobile ? '16px' : '12px',
    bottom: isMobile ? '16px' : '12px',
    zIndex: '2147483647',
    padding: isMobile ? '14px 18px' : '12px 16px',
    borderRadius: isMobile ? '12px' : '8px',
    border: 'none',
    background: '#1f2937',
    color: '#fff',
    fontSize: isMobile ? '16px' : '14px',
    fontWeight: '500',
    boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    minWidth: isMobile ? '56px' : 'auto',
    minHeight: isMobile ? '56px' : 'auto'
  })
  
  managerButton.addEventListener('mouseenter', () => {
    if (!isMobile) {
      managerButton.style.transform = 'scale(1.05)'
    }
  })
  
  managerButton.addEventListener('mouseleave', () => {
    if (!isMobile) {
      managerButton.style.transform = 'scale(1)'
    }
  })
  
  managerButton.addEventListener('touchstart', () => {
    managerButton.style.transform = 'scale(0.95)'
  })
  
  managerButton.addEventListener('touchend', () => {
    managerButton.style.transform = 'scale(1)'
  })
  
  managerButton.addEventListener('click', async () => {
    try {
      // Dynamically import the manager module
      const { openManagementInterface } = await import('./modules/manager')
      openManagementInterface()
    } catch (e) {
      console.error('[Emoji Manager] Failed to open management interface:', e)
    }
  })
  
  // Add settings button with mobile-optimized styling
  const settingsButton = document.createElement('button')
  settingsButton.id = 'emoji-settings-floating-button'
  settingsButton.textContent = isMobile ? '🔧' : '🔧 设置'
  settingsButton.title = 'Open Settings'
  Object.assign(settingsButton.style, {
    position: 'fixed',
    right: isMobile ? '16px' : '12px',
    bottom: isMobile ? '84px' : '70px',
    zIndex: '2147483647',
    padding: isMobile ? '12px 16px' : '10px 14px',
    borderRadius: isMobile ? '12px' : '8px',
    border: 'none',
    background: '#374151',
    color: '#fff',
    fontSize: isMobile ? '15px' : '13px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    minWidth: isMobile ? '52px' : 'auto',
    minHeight: isMobile ? '52px' : 'auto'
  })
  
  settingsButton.addEventListener('mouseenter', () => {
    if (!isMobile) {
      settingsButton.style.transform = 'scale(1.05)'
    }
  })
  
  settingsButton.addEventListener('mouseleave', () => {
    if (!isMobile) {
      settingsButton.style.transform = 'scale(1)'
    }
  })
  
  settingsButton.addEventListener('touchstart', () => {
    settingsButton.style.transform = 'scale(0.95)'
  })
  
  settingsButton.addEventListener('touchend', () => {
    settingsButton.style.transform = 'scale(1)'
  })
  
  settingsButton.addEventListener('click', async () => {
    try {
      const { showSettingsModal } = await import('./modules/settings')
      showSettingsModal()
    } catch (e) {
      console.error('[Emoji Manager] Failed to open settings:', e)
    }
  })
  
  // Add import/export button with mobile-optimized styling
  const importExportButton = document.createElement('button')
  importExportButton.id = 'emoji-importexport-floating-button'
  importExportButton.textContent = isMobile ? '📦' : '📦 导入/导出'
  importExportButton.title = 'Import/Export Data'
  Object.assign(importExportButton.style, {
    position: 'fixed',
    right: isMobile ? '16px' : '12px',
    bottom: isMobile ? '152px' : '128px',
    zIndex: '2147483647',
    padding: isMobile ? '12px 16px' : '10px 14px',
    borderRadius: isMobile ? '12px' : '8px',
    border: 'none',
    background: '#374151',
    color: '#fff',
    fontSize: isMobile ? '15px' : '13px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    minWidth: isMobile ? '52px' : 'auto',
    minHeight: isMobile ? '52px' : 'auto'
  })
  
  importExportButton.addEventListener('mouseenter', () => {
    if (!isMobile) {
      importExportButton.style.transform = 'scale(1.05)'
    }
  })
  
  importExportButton.addEventListener('mouseleave', () => {
    if (!isMobile) {
      importExportButton.style.transform = 'scale(1)'
    }
  })
  
  importExportButton.addEventListener('touchstart', () => {
    importExportButton.style.transform = 'scale(0.95)'
  })
  
  importExportButton.addEventListener('touchend', () => {
    importExportButton.style.transform = 'scale(1)'
  })
  
  importExportButton.addEventListener('click', async () => {
    try {
      const { showImportExportModal } = await import('./modules/importExport')
      showImportExportModal()
    } catch (e) {
      console.error('[Emoji Manager] Failed to open import/export:', e)
    }
  })
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(managerButton)
      document.body.appendChild(settingsButton)
      document.body.appendChild(importExportButton)
    })
  } else {
    document.body.appendChild(managerButton)
    document.body.appendChild(settingsButton)
    document.body.appendChild(importExportButton)
  }
  
  console.log('[Emoji Manager] Initialization complete')
}

// Entry point - only run on Discourse sites
if (isDiscoursePage()) {
  console.log('[Emoji Manager] Discourse detected, initializing management interface')
  initializeEmojiManager()
} else {
  console.log('[Emoji Manager] Not a Discourse site, skipping initialization')
}

export {}
