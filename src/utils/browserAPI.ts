// Browser API compatibility layer for Firefox
// This provides a unified API that works across Chrome and Firefox

declare const chrome: any
declare const browser: any

export interface BrowserAPI {
  storage: {
    local: {
      get: (keys?: string | string[] | object | null) => Promise<any>
      set: (items: object) => Promise<void>
      remove: (keys: string | string[]) => Promise<void>
      clear: () => Promise<void>
    }
    sync: {
      get: (keys?: string | string[] | object | null) => Promise<any>
      set: (items: object) => Promise<void>
      remove: (keys: string | string[]) => Promise<void>
      clear: () => Promise<void>
    }
    onChanged: {
      addListener: (callback: (changes: any, areaName: string) => void) => void
    }
  }
  runtime: {
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: any) => boolean | void) => void
    }
    sendMessage: (message: any) => Promise<any>
    onInstalled: {
      addListener: (callback: (details: any) => void) => void
    }
    lastError?: any
  }
  tabs: {
    query: (queryInfo: any) => Promise<any[]>
    sendMessage: (tabId: number, message: any) => Promise<any>
    executeScript?: (tabId: number, details: any) => Promise<any>
  }
  scripting?: {
    executeScript: (details: any) => Promise<any>
  }
  contextMenus?: {
    create: (createProperties: any) => void
    onClicked: {
      addListener: (callback: (info: any, tab: any) => void) => void
    }
  }
  downloads?: {
    download: (options: any) => Promise<number>
  }
  cookies?: {
    get: (details: any) => Promise<any>
    set: (details: any) => Promise<any>
  }
}

// Get the appropriate browser API
export function getBrowserAPI(): BrowserAPI | null {
  // Firefox uses browser API (WebExtensions)
  if (typeof browser !== 'undefined' && browser.runtime) {
    return createFirefoxAPI()
  }
  
  // Chrome uses chrome API
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return createChromeAPI()
  }
  
  // Fallback for service workers or other contexts
  if (typeof globalThis !== 'undefined') {
    if ((globalThis as any).browser?.runtime) {
      return createFirefoxAPI()
    }
    if ((globalThis as any).chrome?.runtime) {
      return createChromeAPI()
    }
  }
  
  return null
}

function createFirefoxAPI(): BrowserAPI {
  const api = browser
  
  return {
    storage: {
      local: {
        get: (keys) => api.storage.local.get(keys),
        set: (items) => api.storage.local.set(items),
        remove: (keys) => api.storage.local.remove(keys),
        clear: () => api.storage.local.clear()
      },
      sync: {
        get: (keys) => api.storage.sync.get(keys),
        set: (items) => api.storage.sync.set(items),
        remove: (keys) => api.storage.sync.remove(keys),
        clear: () => api.storage.sync.clear()
      },
      onChanged: api.storage.onChanged
    },
    runtime: {
      onMessage: api.runtime.onMessage,
      sendMessage: (message) => api.runtime.sendMessage(message),
      onInstalled: api.runtime.onInstalled,
      get lastError() { return api.runtime.lastError }
    },
    tabs: {
      query: (queryInfo) => api.tabs.query(queryInfo),
      sendMessage: (tabId, message) => api.tabs.sendMessage(tabId, message),
      executeScript: api.tabs.executeScript ? 
        (tabId, details) => api.tabs.executeScript(tabId, details) : undefined
    },
    scripting: api.scripting ? {
      executeScript: (details) => api.scripting.executeScript(details)
    } : undefined,
    contextMenus: api.contextMenus ? {
      create: (createProperties) => api.contextMenus.create(createProperties),
      onClicked: api.contextMenus.onClicked
    } : undefined,
    downloads: api.downloads ? {
      download: (options) => api.downloads.download(options)
    } : undefined,
    cookies: api.cookies ? {
      get: (details) => api.cookies.get(details),
      set: (details) => api.cookies.set(details)
    } : undefined
  }
}

function createChromeAPI(): BrowserAPI {
  const api = chrome
  
  // Helper to promisify Chrome API methods
  function promisify<T>(fn: Function, thisArg?: any): (...args: any[]) => Promise<T> {
    return (...args: any[]) => {
      return new Promise((resolve, reject) => {
        const callback = (result: T) => {
          if (api.runtime.lastError) {
            reject(api.runtime.lastError)
          } else {
            resolve(result)
          }
        }
        fn.apply(thisArg, [...args, callback])
      })
    }
  }
  
  return {
    storage: {
      local: {
        get: promisify(api.storage.local.get, api.storage.local),
        set: promisify(api.storage.local.set, api.storage.local),
        remove: promisify(api.storage.local.remove, api.storage.local),
        clear: promisify(api.storage.local.clear, api.storage.local)
      },
      sync: {
        get: promisify(api.storage.sync.get, api.storage.sync),
        set: promisify(api.storage.sync.set, api.storage.sync),
        remove: promisify(api.storage.sync.remove, api.storage.sync),
        clear: promisify(api.storage.sync.clear, api.storage.sync)
      },
      onChanged: api.storage.onChanged
    },
    runtime: {
      onMessage: api.runtime.onMessage,
      sendMessage: promisify(api.runtime.sendMessage, api.runtime),
      onInstalled: api.runtime.onInstalled,
      get lastError() { return api.runtime.lastError }
    },
    tabs: {
      query: promisify(api.tabs.query, api.tabs),
      sendMessage: promisify(api.tabs.sendMessage, api.tabs),
      executeScript: api.tabs.executeScript ? 
        promisify(api.tabs.executeScript, api.tabs) : undefined
    },
    scripting: api.scripting ? {
      executeScript: promisify(api.scripting.executeScript, api.scripting)
    } : undefined,
    contextMenus: api.contextMenus ? {
      create: (createProperties) => api.contextMenus.create(createProperties),
      onClicked: api.contextMenus.onClicked
    } : undefined,
    downloads: api.downloads ? {
      download: promisify(api.downloads.download, api.downloads)
    } : undefined,
    cookies: api.cookies ? {
      get: promisify(api.cookies.get, api.cookies),
      set: promisify(api.cookies.set, api.cookies)
    } : undefined
  }
}

// Legacy compatibility - maps to getBrowserAPI for existing code
export const getChromeAPI = getBrowserAPI