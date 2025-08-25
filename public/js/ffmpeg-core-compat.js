// FFmpeg Core Mock for Chrome Extensions
// Provides a simplified mock implementation to avoid CSP issues

// Create a mock FFmpeg instance that provides the expected API
function createMockFFmpeg() {
  return {
    load: async function () {
      console.log('[FFmpeg Mock] Load called - using mock implementation')
      return Promise.resolve()
    },
    FS: function (operation, ...args) {
      console.log('[FFmpeg Mock] FS operation:', operation, args)
      if (operation === 'writeFile') {
        // Store file in memory (mock)
        return
      } else if (operation === 'readFile') {
        // Return empty data (mock)
        return new Uint8Array(0)
      } else if (operation === 'unlink') {
        // Delete file (mock)
        return
      }
    },
    run: async function (...args) {
      console.log('[FFmpeg Mock] Run called with args:', args)
      // Mock implementation - just resolve immediately
      return Promise.resolve()
    },
    setLogger: function (logger) {
      console.log('[FFmpeg Mock] Logger set')
    },
    setProgress: function (progress) {
      console.log('[FFmpeg Mock] Progress callback set')
    }
  }
}

// Legacy createFFmpeg function for older API compatibility
function createFFmpeg(options = {}) {
  console.log('[FFmpeg Mock] createFFmpeg called with options:', options)
  return createMockFFmpeg()
}

// New FFmpeg class for v0.12+ API compatibility
class FFmpeg {
  constructor() {
    console.log('[FFmpeg Mock] FFmpeg constructor called')
    this.loaded = false
  }

  async load(options = {}) {
    console.log('[FFmpeg Mock] FFmpeg.load called with options:', options)
    this.loaded = true
    return Promise.resolve()
  }

  FS(operation, ...args) {
    console.log('[FFmpeg Mock] FFmpeg.FS operation:', operation, args)
    if (operation === 'writeFile') {
      return
    } else if (operation === 'readFile') {
      return new Uint8Array(0)
    } else if (operation === 'unlink') {
      return
    }
  }

  async run(...args) {
    console.log('[FFmpeg Mock] FFmpeg.run called with args:', args)
    if (!this.loaded) {
      throw new Error('FFmpeg is not loaded')
    }
    return Promise.resolve()
  }

  setLogger(logger) {
    console.log('[FFmpeg Mock] FFmpeg.setLogger called')
  }

  setProgress(progress) {
    console.log('[FFmpeg Mock] FFmpeg.setProgress called')
  }
}

// fetchFile utility function
function fetchFile(file) {
  if (file instanceof File) {
    return file.arrayBuffer().then(buffer => new Uint8Array(buffer))
  } else if (typeof file === 'string') {
    // URL case
    return fetch(file)
      .then(response => response.arrayBuffer())
      .then(buffer => new Uint8Array(buffer))
  }
  return Promise.resolve(new Uint8Array(0))
}

// Export the API for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS
  module.exports = {
    FFmpeg,
    createFFmpeg,
    fetchFile
  }
} else if (typeof window !== 'undefined') {
  // Browser window
  window.FFmpeg = FFmpeg
  window.createFFmpeg = createFFmpeg
  window.fetchFile = fetchFile
} else if (typeof self !== 'undefined') {
  // Web Worker
  self.FFmpeg = FFmpeg
  self.createFFmpeg = createFFmpeg
  self.fetchFile = fetchFile
}

// Also create a default export for ES modules
if (typeof globalThis !== 'undefined') {
  globalThis.FFmpeg = FFmpeg
  globalThis.createFFmpeg = createFFmpeg
  globalThis.fetchFile = fetchFile
}
