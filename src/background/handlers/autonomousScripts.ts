// Autonomous Script Handler
// Handles requests for autonomous platform scripts

import fs from 'fs'
import path from 'path'

// Store for autonomous script content
const autonomousScriptCache = new Map<string, string>()

// Available autonomous scripts
const AVAILABLE_SCRIPTS = {
  'discourse': 'discourse-script.js',
  'x': 'x-script.js', 
  'pixiv': 'pixiv-script.js',
  'reddit': 'reddit-script.js',
  'loader': 'loader.js'
}

// Load script content from file system (for development/extension builds)
function loadScriptFromFile(scriptName: string): string | null {
  try {
    // In a real extension, these would be bundled or loaded from the extension directory
    const scriptPath = path.resolve(__dirname, '..', '..', 'dist', 'autonomous', scriptName)
    
    if (fs.existsSync(scriptPath)) {
      return fs.readFileSync(scriptPath, 'utf8')
    } else {
      console.warn(`[AutonomousHandler] Script file not found: ${scriptPath}`)
      return null
    }
  } catch (e) {
    console.error(`[AutonomousHandler] Failed to load script ${scriptName}:`, e)
    return null
  }
}

// Get embedded script content (for userscript builds)
function getEmbeddedScript(platform: string): string | null {
  // In userscript builds, the autonomous scripts would be embedded here
  // For now, return null to indicate scripts should be loaded from files
  return null
}

// Get autonomous script content for a platform
function getAutonomousScript(platform: string): string | null {
  try {
    // Check cache first
    const cacheKey = `script-${platform}`
    if (autonomousScriptCache.has(cacheKey)) {
      return autonomousScriptCache.get(cacheKey)!
    }
    
    // Check if platform is supported
    const scriptFileName = AVAILABLE_SCRIPTS[platform as keyof typeof AVAILABLE_SCRIPTS]
    if (!scriptFileName) {
      console.warn(`[AutonomousHandler] Unsupported platform: ${platform}`)
      return null
    }
    
    // Try embedded first (for userscript builds)
    let scriptContent = getEmbeddedScript(platform)
    
    // Fall back to file system (for extension builds)
    if (!scriptContent) {
      scriptContent = loadScriptFromFile(scriptFileName)
    }
    
    if (scriptContent) {
      // Cache the script content
      autonomousScriptCache.set(cacheKey, scriptContent)
      console.log(`[AutonomousHandler] Loaded script for platform: ${platform}`)
    } else {
      console.warn(`[AutonomousHandler] Failed to load script for platform: ${platform}`)
    }
    
    return scriptContent
  } catch (e) {
    console.error(`[AutonomousHandler] Error getting autonomous script for ${platform}:`, e)
    return null
  }
}

// Handle GET_AUTONOMOUS_SCRIPT request
export function handleGetAutonomousScript(platform: string, sendResponse: (response: any) => void): void {
  try {
    console.log(`[AutonomousHandler] Request for autonomous script: ${platform}`)
    
    const scriptContent = getAutonomousScript(platform)
    
    if (scriptContent) {
      sendResponse({
        success: true,
        platform: platform,
        scriptContent: scriptContent,
        timestamp: Date.now()
      })
    } else {
      sendResponse({
        success: false,
        error: `Script not available for platform: ${platform}`,
        platform: platform
      })
    }
  } catch (e) {
    console.error(`[AutonomousHandler] Failed to handle script request for ${platform}:`, e)
    sendResponse({
      success: false,
      error: `Failed to process request: ${e.message}`,
      platform: platform
    })
  }
}

// Handle platform detection notifications
export function handlePlatformDetected(platform: string, url: string, sendResponse: (response: any) => void): void {
  try {
    console.log(`[AutonomousHandler] Platform detected: ${platform} on ${url}`)
    
    // Log platform detection for analytics/debugging
    // In a real implementation, you might want to store this data
    
    sendResponse({
      success: true,
      message: 'Platform detection acknowledged',
      platform: platform,
      timestamp: Date.now()
    })
  } catch (e) {
    console.error(`[AutonomousHandler] Failed to handle platform detection:`, e)
    sendResponse({
      success: false,
      error: e.message
    })
  }
}

// Handle autonomous script loaded notifications
export function handleAutonomousScriptLoaded(platform: string, url: string, sendResponse: (response: any) => void): void {
  try {
    console.log(`[AutonomousHandler] Autonomous script loaded: ${platform} on ${url}`)
    
    // Log successful script loading
    // In a real implementation, you might want to store this data for debugging
    
    sendResponse({
      success: true,
      message: 'Script loading acknowledged',
      platform: platform,
      timestamp: Date.now()
    })
  } catch (e) {
    console.error(`[AutonomousHandler] Failed to handle script loaded notification:`, e)
    sendResponse({
      success: false,
      error: e.message
    })
  }
}

// Handle autonomous script ready notifications  
export function handleAutonomousScriptReady(platform: string, url: string, sendResponse: (response: any) => void): void {
  try {
    console.log(`[AutonomousHandler] Autonomous script ready: ${platform} on ${url}`)
    
    // Log script ready status
    // This indicates the autonomous script has initialized and is functional
    
    sendResponse({
      success: true,
      message: 'Script ready acknowledged',
      platform: platform,
      timestamp: Date.now()
    })
  } catch (e) {
    console.error(`[AutonomousHandler] Failed to handle script ready notification:`, e)
    sendResponse({
      success: false,
      error: e.message
    })
  }
}

// Clear cached scripts (useful for development)
export function clearAutonomousScriptCache(): void {
  autonomousScriptCache.clear()
  console.log('[AutonomousHandler] Script cache cleared')
}

// Get cache status for debugging
export function getAutonomousScriptCacheStatus(): { size: number; keys: string[] } {
  return {
    size: autonomousScriptCache.size,
    keys: Array.from(autonomousScriptCache.keys())
  }
}