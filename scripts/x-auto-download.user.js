// ==UserScript==
// @name         X.com Auto Download
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Automatically download images from X.com based on configured suffixes
// @author       Code
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_registerMenuCommand
// ==/UserScript==

;(function () {
  'use strict'

  // --- Utils ---
  function normalizeUrl(raw) {
    if (!raw) return null
    raw = raw.trim()
    const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
    if (urlMatch) raw = urlMatch[1]
    if (raw.startsWith('//')) raw = 'https:' + raw
    else if (raw.startsWith('/')) raw = window.location.origin + raw

    if (raw.includes(',')) raw = raw.split(',')[0]
    raw = raw.split(' ')[0]
    raw = raw.replace(/:large$|:orig$/i, '')

    if (!/^https?:\/\//i.test(raw)) return null

    try {
      const u = new URL(raw)
      const host = u.hostname.toLowerCase()
      const allowed = ['pbs.twimg.com', 'twimg.com', 'twitter.com', 'x.com', 'pbs.twimg']
      const ok = allowed.some(a => host.endsWith(a) || host.includes(a))
      if (!ok) return null
    } catch {
      return null
    }

    return raw
  }

  // --- AutoDownloadManager ---
  class AutoDownloadManager {
    constructor() {
      this.DOWNLOAD_HISTORY_KEY = 'x-autodownload-history'
      this.HISTORY_EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24 hours
      this.settings = this.loadSettings()
      this.cleanExpiredHistory()
    }

    loadSettings() {
      const defaults = ['name=large', 'name=4096x4096']
      let suffixes = GM_getValue('autoDownloadSuffixes', defaults)

      // 防呆：確保讀出來的一定是陣列
      if (typeof suffixes === 'string') {
        try {
          suffixes = JSON.parse(suffixes)
        } catch {
          suffixes = suffixes.split(',').map(s => s.trim())
        }
      }
      if (!Array.isArray(suffixes)) suffixes = defaults

      return {
        enableAutoDownload: GM_getValue('enableAutoDownload', false),
        autoDownloadSuffixes: suffixes
      }
    }

    updateSettings(key, value) {
      GM_setValue(key, value)
      this.settings[key] = value
    }

    cleanExpiredHistory() {
      try {
        const historyData = GM_getValue(this.DOWNLOAD_HISTORY_KEY, '{}')
        const history = JSON.parse(historyData)
        const now = Date.now()
        const cleanedHistory = {}

        for (const [url, timestamp] of Object.entries(history)) {
          if (now - timestamp < this.HISTORY_EXPIRY_TIME) {
            cleanedHistory[url] = timestamp
          }
        }

        GM_setValue(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(cleanedHistory))
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to clean history:', error)
      }
    }

    addToHistory(url) {
      try {
        const historyData = GM_getValue(this.DOWNLOAD_HISTORY_KEY, '{}')
        const history = JSON.parse(historyData)
        history[url] = Date.now()
        GM_setValue(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(history))
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to add to history:', error)
      }
    }

    isInHistory(url) {
      try {
        const historyData = GM_getValue(this.DOWNLOAD_HISTORY_KEY, '{}')
        const history = JSON.parse(historyData)
        const timestamp = history[url]
        if (!timestamp) return false

        const now = Date.now()
        if (now - timestamp < this.HISTORY_EXPIRY_TIME) {
          return true
        } else {
          delete history[url]
          GM_setValue(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(history))
          return false
        }
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to check history:', error)
        return false
      }
    }

    shouldDownload(url) {
      if (!this.settings.enableAutoDownload) return false
      if (this.isInHistory(url)) return false

      const suffixes = Array.isArray(this.settings.autoDownloadSuffixes)
        ? this.settings.autoDownloadSuffixes
        : []

      if (suffixes.length === 0) return false

      const decodedUrl = decodeURIComponent(url)

      return suffixes.some(suffix => {
        if (!suffix) return false
        return decodedUrl.includes(suffix)
      })
    }

    triggerAutoDownload(imageUrl) {
      if (!this.shouldDownload(imageUrl)) return

      console.log(`[AutoDownloadManager] Triggering download for: ${imageUrl}`)
      this.addToHistory(imageUrl)

      let filename = 'image'
      try {
        const parsedUrl = new URL(imageUrl)
        const pathname = parsedUrl.pathname
        const lastSegment = pathname.split('/').pop()
        if (lastSegment) {
          filename = lastSegment
        }
        const format = parsedUrl.searchParams.get('format')
        if (format && !filename.includes(`.${format}`)) {
          filename += `.${format}`
        }
      } catch (e) {
        console.warn('[AutoDownloadManager] Failed to parse URL for filename:', e)
      }

      GM_download({
        url: imageUrl,
        name: filename,
        onload: () => console.log(`[AutoDownloadManager] Download success: ${imageUrl}`),
        onerror: err => console.error(`[AutoDownloadManager] Download failed: ${imageUrl}`, err)
      })
    }
  }

  const autoDownloadManager = new AutoDownloadManager()

  // --- Settings UI ---
  class SettingsUI {
    constructor(manager) {
      this.manager = manager
      this.menuElement = null
      this.init()
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.inject())
      } else {
        this.inject()
      }
    }

    inject() {
      if (document.getElementById('x-autodownload-toggle')) return
      const toggleButton = this.createToggleButton()
      document.body.appendChild(toggleButton)
    }

    createToggleButton() {
      const button = document.createElement('div')
      button.id = 'x-autodownload-toggle'
      button.innerHTML = '⚙️'
      button.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                width: 40px;
                height: 40px;
                background: white;
                border: 1px solid #e1e8ed;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                font-size: 16px;
                transition: all 0.2s ease;
            `
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)'
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
      })
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)'
        button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
      })
      button.addEventListener('click', () => this.toggleMenu())
      return button
    }

    createSettingsMenu() {
      const menu = document.createElement('div')
      menu.id = 'x-autodownload-settings-menu'
      menu.style.cssText = `
                position: fixed;
                top: 20px;
                right: 70px;
                z-index: 10000;
                background: white;
                border: 1px solid #e1e8ed;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                width: 320px;
                display: none;
                color: #0f1419;
            `

      const title = document.createElement('div')
      title.textContent = 'Auto Download Settings'
      title.style.fontWeight = '700'
      title.style.marginBottom = '16px'
      title.style.fontSize = '16px'
      menu.appendChild(title)

      // --- Enable Switch ---
      const switchContainer = document.createElement('div')
      switchContainer.style.display = 'flex'
      switchContainer.style.alignItems = 'center'
      switchContainer.style.marginBottom = '16px'

      const switchLabel = document.createElement('label')
      switchLabel.style.cssText =
        'display: flex; align-items: center; cursor: pointer; flex: 1; user-select: none;'

      const switchInput = document.createElement('input')
      switchInput.type = 'checkbox'
      switchInput.checked = this.manager.settings.enableAutoDownload
      switchInput.style.marginRight = '8px'

      switchLabel.appendChild(switchInput)
      switchLabel.appendChild(document.createTextNode('Enable Auto Download'))
      switchContainer.appendChild(switchLabel)
      menu.appendChild(switchContainer)

      // --- Suffix List Section ---
      const suffixSection = document.createElement('div')
      suffixSection.id = 'suffix-section'

      const suffixLabel = document.createElement('div')
      suffixLabel.textContent = 'URL Suffixes:'
      suffixLabel.style.cssText =
        'font-size: 13px; font-weight: 600; color: #536471; margin-bottom: 8px;'
      suffixSection.appendChild(suffixLabel)

      // List Container (Tags)
      const listContainer = document.createElement('div')
      listContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 12px;
                max-height: 200px;
                overflow-y: auto;
            `
      suffixSection.appendChild(listContainer)

      // Input Row
      const inputRow = document.createElement('div')
      inputRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;'

      const inputField = document.createElement('input')
      inputField.type = 'text'
      inputField.placeholder = 'Add suffix (e.g. name=large)'
      inputField.style.cssText = `
                flex: 1;
                padding: 6px 10px;
                border: 1px solid #cfd9de;
                border-radius: 4px;
                font-size: 13px;
                outline: none;
            `
      inputField.addEventListener('focus', () => (inputField.style.borderColor = '#1d9bf0'))
      inputField.addEventListener('blur', () => (inputField.style.borderColor = '#cfd9de'))

      const addBtn = document.createElement('button')
      addBtn.textContent = 'Add'
      addBtn.style.cssText = `
                padding: 6px 12px;
                background: #0f1419;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
            `

      // Logic to add item
      const addItem = () => {
        const val = inputField.value.trim()
        if (!val) return

        const current = [...this.manager.settings.autoDownloadSuffixes]
        if (!current.includes(val)) {
          current.push(val)
          this.manager.updateSettings('autoDownloadSuffixes', current)
          renderList()
          inputField.value = ''
        }
      }

      addBtn.addEventListener('click', addItem)
      inputField.addEventListener('keypress', e => {
        if (e.key === 'Enter') addItem()
      })

      inputRow.appendChild(inputField)
      inputRow.appendChild(addBtn)
      suffixSection.appendChild(inputRow)
      menu.appendChild(suffixSection)

      // --- Render Logic ---
      const renderList = () => {
        listContainer.innerHTML = ''
        const suffixes = this.manager.settings.autoDownloadSuffixes

        if (suffixes.length === 0) {
          const emptyMsg = document.createElement('div')
          emptyMsg.textContent = 'No suffixes configured'
          emptyMsg.style.cssText =
            'color: #999; font-style: italic; font-size: 12px; padding: 4px 0;'
          listContainer.appendChild(emptyMsg)
          return
        }

        suffixes.forEach((suffix, index) => {
          const tag = document.createElement('div')
          tag.style.cssText = `
                        background: #eff3f4;
                        border: 1px solid #cfd9de;
                        border-radius: 16px;
                        padding: 4px 10px;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    `

          const text = document.createElement('span')
          text.textContent = suffix
          tag.appendChild(text)

          const delBtn = document.createElement('span')
          delBtn.innerHTML = '×'
          delBtn.style.cssText = `
                        cursor: pointer;
                        font-weight: bold;
                        color: #536471;
                        font-size: 14px;
                        line-height: 1;
                    `
          delBtn.addEventListener('mouseover', () => (delBtn.style.color = '#f4212e'))
          delBtn.addEventListener('mouseout', () => (delBtn.style.color = '#536471'))
          delBtn.addEventListener('click', () => {
            const current = [...this.manager.settings.autoDownloadSuffixes]
            current.splice(index, 1)
            this.manager.updateSettings('autoDownloadSuffixes', current)
            renderList()
          })

          tag.appendChild(delBtn)
          listContainer.appendChild(tag)
        })
      }

      // Switch Visibility Logic
      switchInput.addEventListener('change', e => {
        this.manager.updateSettings('enableAutoDownload', e.target.checked)
        this.updateSuffixesVisibility()
      })

      this.updateSuffixesVisibility = () => {
        const isEnabled = this.manager.settings.enableAutoDownload
        suffixSection.style.display = isEnabled ? 'block' : 'none'
        if (isEnabled) renderList()
      }

      // Initial render
      this.updateSuffixesVisibility()

      // --- Close Button ---
      const closeBtn = document.createElement('button')
      closeBtn.textContent = 'Close Settings'
      closeBtn.style.cssText = `
                display: block;
                width: 100%;
                padding: 8px;
                background: white;
                border: 1px solid #cfd9de;
                color: #536471;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                margin-top: 16px;
                font-weight: 600;
                transition: background 0.2s;
            `
      closeBtn.addEventListener('mouseover', () => (closeBtn.style.background = '#f7f9f9'))
      closeBtn.addEventListener('mouseout', () => (closeBtn.style.background = 'white'))
      closeBtn.addEventListener('click', () => this.hideMenu())
      menu.appendChild(closeBtn)

      return menu
    }

    toggleMenu() {
      if (!this.menuElement) {
        this.menuElement = this.createSettingsMenu()
        document.body.appendChild(this.menuElement)
      }
      this.menuElement.style.display = this.menuElement.style.display === 'none' ? 'block' : 'none'
    }

    hideMenu() {
      if (this.menuElement) this.menuElement.style.display = 'none'
    }
  }

  new SettingsUI(autoDownloadManager)

  // --- Image Observer ---
  function observeImages() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Element
              checkForImages(node)
            }
          })
        } else if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
          checkImage(mutation.target)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    })

    // Initial scan
    checkForImages(document.body)
  }

  function checkForImages(root) {
    const imgs = root.querySelectorAll('img')
    imgs.forEach(checkImage)
    if (root.tagName === 'IMG') checkImage(root)
  }

  function checkImage(img) {
    const src = img.src
    if (!src) return
    const normalized = normalizeUrl(src)
    if (normalized) {
      autoDownloadManager.triggerAutoDownload(normalized)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeImages)
  } else {
    observeImages()
  }
})()
