/**
 * Anti-Cheat 动态脚本注册管理器
 * 仿照油猴的注入方式，使用 chrome.scripting.registerContentScripts
 * 在 document_start 时注入到页面主世界（MAIN world）
 */

const ANTI_CHEAT_SCRIPT_ID = 'anti-cheat-watermark-replacer'

/**
 * 生成要注入的脚本代码
 */
function generateScriptCode(customText: string): string {
  return `
(function() {
  'use strict';

  if (window.__antiCheatInitialized) return;
  window.__antiCheatInitialized = true;

  const CUSTOM_TEXT = ${JSON.stringify(customText)};
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    const pixelRatio = window.devicePixelRatio || 1;
    // 130 是 Discourse 源码中的 density 设置
    if (this.width === this.height && Math.abs(this.width - (130 * pixelRatio)) < 5) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const originalColor = ctx.fillStyle;
        const originalFont = ctx.font;
        const w = this.width;
        const h = this.height;

        // 清空画布
        this.width = w;

        // 重绘自定义文字
        ctx.fillStyle = originalColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = originalFont;

        ctx.translate(w / 2, h / 2);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.fillText(CUSTOM_TEXT, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    }
    return originalToDataURL.apply(this, arguments);
  };

  console.log('[AntiCheat] Watermark replacer active:', CUSTOM_TEXT);
})();
`
}

/**
 * 注册 Anti-Cheat 脚本
 */
export async function registerAntiCheatScript(customText: string): Promise<void> {
  try {
    // 先尝试注销已有的脚本
    await unregisterAntiCheatScript()

    const code = generateScriptCode(customText)

    // 使用 chrome.scripting.registerContentScripts 动态注册
    // world: "MAIN" 让脚本在页面主世界运行（类似油猴）
    // runAt: "document_start" 尽早运行
    await chrome.scripting.registerContentScripts([
      {
        id: ANTI_CHEAT_SCRIPT_ID,
        matches: ['*://*.linux.do/*', '*://*.discourse.org/*'],
        js: [], // 我们用 func 代替
        runAt: 'document_start',
        world: 'MAIN' as any,
        allFrames: false
      }
    ])

    // registerContentScripts 不支持直接传代码，需要用文件
    // 所以我们改用 executeScript 配合 tabs.onUpdated 来实现
    // 这里先注销，改用监听方式
    await unregisterAntiCheatScript()

    console.log('[AntiCheat] Script registration mode: using tabs.onUpdated listener')
  } catch (e) {
    console.error('[AntiCheat] Failed to register script:', e)
  }
}

/**
 * 注销 Anti-Cheat 脚本
 */
export async function unregisterAntiCheatScript(): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [ANTI_CHEAT_SCRIPT_ID]
    })
  } catch {
    // 可能脚本不存在，忽略错误
  }
}

/**
 * 在指定 tab 注入 Anti-Cheat 脚本
 */
export async function injectAntiCheatToTab(tabId: number, customText: string): Promise<void> {
  try {
    const code = generateScriptCode(customText)

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (scriptCode: string) => {
        // 创建 script 标签注入到页面
        const script = document.createElement('script')
        script.textContent = scriptCode
        ;(document.head || document.documentElement).appendChild(script)
        script.remove()
      },
      args: [code],
      world: 'MAIN' as any,
      injectImmediately: true
    })

    console.log(`[AntiCheat] Injected to tab ${tabId}`)
  } catch (e) {
    // 可能是特殊页面（chrome://、about: 等），忽略
    if (!(e instanceof Error && e.message.includes('Cannot access'))) {
      console.warn(`[AntiCheat] Failed to inject to tab ${tabId}:`, e)
    }
  }
}

/**
 * 检查 URL 是否是 Discourse 站点
 */
export function isDiscourseUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname
    return (
      host.includes('linux.do') || host.includes('discourse.org') || host.endsWith('.discourse.org')
    )
  } catch {
    return false
  }
}

const DefaultCache = {
  enableExperimentalFeatures: false,
  enableAntiCheat: false,
  antiCheatCustomText: ''
}

// 缓存设置避免重复读取
let cachedSettings: {
  enableExperimentalFeatures?: boolean
  enableAntiCheat?: boolean
  antiCheatCustomText?: string
} | null = DefaultCache

/**
 * 获取 Anti-Cheat 设置
 */
async function getAntiCheatSettings(): Promise<{
  enabled: boolean
  customText: string
}> {
  try {
    const result = await chrome.storage.local.get(['settings'])
    const settings = result.settings || DefaultCache
    cachedSettings = settings

    const enabled =
      settings.enableExperimentalFeatures === true && settings.enableAntiCheat === true
    const customText = settings.antiCheatCustomText || '❌在错误的地方'

    return { enabled, customText }
  } catch {
    return { enabled: false, customText: '❌在错误的地方' }
  }
}

/**
 * 设置 Anti-Cheat 监听器
 * 仿照油猴：在页面导航时注入脚本到 MAIN world
 */
export function setupAntiCheatListener(): void {
  // 监听 tab 更新事件
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // 只在页面开始加载时注入（尽早）
    if (changeInfo.status !== 'loading') return

    // 检查 URL 是否是 Discourse 站点
    const url = tab.url || changeInfo.url
    if (!url || !isDiscourseUrl(url)) return

    // 获取设置
    const { enabled, customText } = await getAntiCheatSettings()
    if (!enabled) return

    // 注入脚本
    await injectAntiCheatToTab(tabId, customText)
  })

  // 监听 storage 变化，更新缓存
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      cachedSettings = changes.settings.newValue || {}
    }
  })

  console.log('[AntiCheat] Listener setup complete')
}
