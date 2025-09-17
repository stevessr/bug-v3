// Autonomous Script Loader
// Platform detection and autonomous script injection system
// This script detects the current platform and loads the appropriate autonomous script

;(function () {
  'use strict'

  // ==== Platform Detection ====
  function detectPlatform(): 'discourse' | 'x' | 'pixiv' | 'reddit' | 'unknown' {
    try {
      const hostname = window.location.hostname.toLowerCase()
      const url = window.location.href.toLowerCase()

      // X (Twitter) detection
      if (
        hostname === 'x.com' ||
        hostname.endsWith('.x.com') ||
        hostname === 'twitter.com' ||
        hostname.endsWith('.twitter.com') ||
        hostname.includes('twitter.com')
      ) {
        return 'x'
      }

      // Pixiv detection
      if (
        hostname.includes('pixiv.net') ||
        hostname.includes('pximg.net') ||
        hostname.includes('i.pximg.net')
      ) {
        return 'pixiv'
      }

      // Reddit detection
      if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
        return 'reddit'
      }

      // Discourse detection - check meta tags first
      const discourseMetaTags = document.querySelectorAll(
        'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
      )
      if (discourseMetaTags.length > 0) {
        return 'discourse'
      }

      // Check generator meta tag
      const generatorMeta = document.querySelector('meta[name="generator"]')
      if (generatorMeta) {
        const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
        if (
          content.includes('discourse') ||
          content.includes('flarum') ||
          content.includes('phpbb')
        ) {
          return 'discourse'
        }
      }

      // Check known discourse domains
      const discourseDomains = ['linux.do', 'meta.discourse.org']
      if (discourseDomains.some(domain => hostname.includes(domain))) {
        return 'discourse'
      }

      // Check for discourse editor elements
      const editors = document.querySelectorAll(
        'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input'
      )
      if (editors.length > 0) {
        return 'discourse'
      }

      // Additional meta-based detections
      const ogSite =
        document
          .querySelector('meta[property="og:site_name"]')
          ?.getAttribute('content')
          ?.toLowerCase() || ''
      if (ogSite.includes('pixiv')) return 'pixiv'
      if (ogSite.includes('reddit')) return 'reddit'
      if (ogSite.includes('discourse')) return 'discourse'

      return 'unknown'
    } catch (e) {
      console.error('[AutonomousLoader] Platform detection failed', e)
      return 'unknown'
    }
  }

  // ==== Chrome Extension Communication ====
  function sendToBackground(message: any): Promise<any> {
    return new Promise(resolve => {
      try {
        const chromeAPI = (window as any).chrome
        if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
          chromeAPI.runtime.sendMessage(message, (response: any) => {
            resolve(response || { success: false, error: 'No response' })
          })
        } else {
          console.warn('[AutonomousLoader] Chrome runtime not available')
          resolve({ success: false, error: 'Chrome runtime not available' })
        }
      } catch (e) {
        console.error('[AutonomousLoader] Failed to send message to background', e)
        resolve({ success: false, error: e.message })
      }
    })
  }

  // ==== Script Injection Functions ====
  function injectScript(scriptContent: string, scriptId: string): boolean {
    try {
      // Check if script is already injected
      if (document.getElementById(scriptId)) {
        console.log(`[AutonomousLoader] Script ${scriptId} already injected`)
        return true
      }

      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'text/javascript'
      script.textContent = scriptContent

      // Inject into document head or body
      const target = document.head || document.documentElement
      target.appendChild(script)

      console.log(`[AutonomousLoader] Successfully injected ${scriptId}`)
      return true
    } catch (e) {
      console.error(`[AutonomousLoader] Failed to inject script ${scriptId}:`, e)
      return false
    }
  }

  // ==== Script Content Requests ====
  async function requestAutonomousScript(platform: string): Promise<string | null> {
    try {
      const response = await sendToBackground({
        type: 'GET_AUTONOMOUS_SCRIPT',
        platform: platform
      })

      if (response.success && response.scriptContent) {
        return response.scriptContent
      } else {
        console.warn(`[AutonomousLoader] Failed to get script for ${platform}:`, response.error)
        return null
      }
    } catch (e) {
      console.error(`[AutonomousLoader] Request failed for ${platform}:`, e)
      return null
    }
  }

  // ==== Built-in Script Fallbacks ====
  // These are minimal fallbacks in case the background script is not available
  const FALLBACK_SCRIPTS = {
    discourse: `
    console.log('[AutonomousLoader] Discourse fallback script loaded');
    // Minimal discourse functionality here
  `,
    x: `
    console.log('[AutonomousLoader] X fallback script loaded');
    // Minimal X functionality here
  `,
    pixiv: `
    console.log('[AutonomousLoader] Pixiv fallback script loaded');
    // Minimal Pixiv functionality here
  `,
    reddit: `
    console.log('[AutonomousLoader] Reddit fallback script loaded');
    // Minimal Reddit functionality here
  `
  }

  // ==== Main Loading Logic ====
  async function loadAutonomousScript(platform: string): Promise<boolean> {
    try {
      console.log(`[AutonomousLoader] Loading autonomous script for platform: ${platform}`)

      // First, try to get the script from the background
      let scriptContent = await requestAutonomousScript(platform)

      // If that fails, use the fallback script
      if (!scriptContent && FALLBACK_SCRIPTS[platform as keyof typeof FALLBACK_SCRIPTS]) {
        console.log(`[AutonomousLoader] Using fallback script for ${platform}`)
        scriptContent = FALLBACK_SCRIPTS[platform as keyof typeof FALLBACK_SCRIPTS]
      }

      if (!scriptContent) {
        console.warn(`[AutonomousLoader] No script available for platform: ${platform}`)
        return false
      }

      // Inject the script
      const scriptId = `autonomous-script-${platform}`
      const success = injectScript(scriptContent, scriptId)

      if (success) {
        // Notify background that we've loaded an autonomous script
        sendToBackground({
          type: 'AUTONOMOUS_SCRIPT_LOADED',
          platform: platform,
          url: window.location.href,
          timestamp: Date.now()
        })
      }

      return success
    } catch (e) {
      console.error(`[AutonomousLoader] Failed to load script for ${platform}:`, e)
      return false
    }
  }

  // ==== Initialization and Auto-Detection ====
  async function initAutonomousLoader() {
    try {
      console.log('[AutonomousLoader] Initializing autonomous script loader...')

      // Detect the current platform
      const platform = detectPlatform()
      console.log(`[AutonomousLoader] Detected platform: ${platform}`)

      if (platform === 'unknown') {
        console.log('[AutonomousLoader] Unknown platform, no autonomous script will be loaded')
        return
      }

      // Request backend injection notification
      sendToBackground({
        type: 'PLATFORM_DETECTED',
        platform: platform,
        url: window.location.href,
        timestamp: Date.now()
      })

      // Load the appropriate autonomous script
      const success = await loadAutonomousScript(platform)

      if (success) {
        console.log(`[AutonomousLoader] Successfully initialized autonomous script for ${platform}`)
      } else {
        console.error(`[AutonomousLoader] Failed to initialize autonomous script for ${platform}`)
      }
    } catch (e) {
      console.error('[AutonomousLoader] Initialization failed:', e)
    }
  }

  // ==== Entry Point ====
  // Run the loader when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutonomousLoader)
  } else {
    // DOM is already ready
    initAutonomousLoader()
  }

  // Also run on page load to catch any late changes
  window.addEventListener('load', () => {
    // Re-run detection after a short delay in case the page changed
    setTimeout(initAutonomousLoader, 1000)
  })
})()
