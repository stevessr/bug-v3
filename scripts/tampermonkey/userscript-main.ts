// Import the main content injection functionality
import { installDefaultNachonekoPicker } from '../../src/helper/inject/feature'
import store from '../../src/data/store/main'

// Userscript storage adapter
class UserscriptStorage {
  async getItem(key: string): Promise<any> {
    try {
      const value = (globalThis as any).GM_getValue?.(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Userscript storage getItem error:', error)
      return null
    }
  }

  async setItem(key: string, value: any): Promise<void> {
    try {
      ;(globalThis as any).GM_setValue?.(key, JSON.stringify(value))
    } catch (error) {
      console.error('Userscript storage setItem error:', error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      ;(globalThis as any).GM_deleteValue?.(key)
    } catch (error) {
      console.error('Userscript storage removeItem error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = (globalThis as any).GM_listValues?.() || []
      keys.forEach((key: string) => (globalThis as any).GM_deleteValue?.(key))
    } catch (error) {
      console.error('Userscript storage clear error:', error)
    }
  }

  async keys(): Promise<string[]> {
    try {
      return (globalThis as any).GM_listValues?.() || []
    } catch (error) {
      console.error('Userscript storage keys error:', error)
      return []
    }
  }
}

// Initialize userscript storage
const storage = new UserscriptStorage()

// Override global storage for userscript environment
if (typeof window !== 'undefined') {
  ;(window as any).__USERSCRIPT_STORAGE__ = storage
}

// Check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]',
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Userscript] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Emoji Userscript] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some((domain) => hostname.includes(domain))) {
    console.log('[Emoji Userscript] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea',
  )
  if (editors.length > 0) {
    console.log('[Emoji Userscript] Discussion editor detected')
    return true
  }

  console.log('[Emoji Userscript] No compatible platform detected')
  return false
}

// Initialize the emoji feature
function initializeEmoji() {
  console.log('[Emoji Userscript] Initializing emoji feature...')

  try {
    const picker = installDefaultNachonekoPicker()
    if (picker && typeof picker.stop === 'function') {
      // Store cleanup function for potential future use
      ;(window as any).__EMOJI_CLEANUP__ = picker.stop
    }
    console.log('[Emoji Userscript] Emoji feature initialized successfully')
  } catch (error) {
    console.error('[Emoji Userscript] Failed to initialize emoji feature:', error)
  }
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  console.log('[Emoji Userscript] Starting emoji injection...')

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEmoji)
  } else {
    initializeEmoji()
  }

  // Add management interface access
  if (typeof (globalThis as any).GM_notification !== 'undefined') {
    // Add a way to open management interface
    const managementEntry = document.createElement('div')
    managementEntry.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      background: #007cba;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      opacity: 0.8;
      transition: opacity 0.3s;
    `
    managementEntry.textContent = '表情管理'
    managementEntry.title = '点击打开表情包管理界面'

    managementEntry.addEventListener('click', () => {
      const managementUrl =
        'data:text/html;charset=utf-8,' +
        encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>表情包管理 - Userscript</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #007cba; color: white; padding: 20px; margin: -20px -20px 20px -20px; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .button { background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
            .button:hover { background: #005a8b; }
            .info { background: #f0f8ff; padding: 15px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Linux.do 表情包扩展 - Userscript 管理界面</h1>
            <p>用户脚本版本的表情包管理工具</p>
          </div>
          
          <div class="section">
            <h3>功能状态</h3>
            <div class="info">
              ✅ 表情包注入功能已启用<br>
              ✅ 用户脚本存储系统正常<br>
              ✅ 支持 Linux.do 和其他 Discourse 论坛
            </div>
          </div>
          
          <div class="section">
            <h3>管理操作</h3>
            <button class="button" onclick="clearStorage()">清除所有数据</button>
            <button class="button" onclick="exportData()">导出设置</button>
            <button class="button" onclick="importData()">导入设置</button>
            <button class="button" onclick="window.close()">关闭</button>
          </div>
          
          <div class="section">
            <h3>使用说明</h3>
            <ul>
              <li>表情包按钮会自动添加到编辑器工具栏</li>
              <li>点击表情包按钮可以选择和插入表情</li>
              <li>设置和数据通过用户脚本存储系统保存</li>
              <li>支持自定义表情包和分组管理</li>
            </ul>
          </div>
          
          <script>
            function clearStorage() {
              if (confirm('确定要清除所有表情包数据吗？此操作不可撤销。')) {
                alert('存储清除功能需要在用户脚本环境中实现')
              }
            }
            
            function exportData() {
              alert('导出功能需要在用户脚本环境中实现')
            }
            
            function importData() {
              alert('导入功能需要在用户脚本环境中实现')
            }
          </script>
        </body>
        </html>
      `)
      window.open(managementUrl, '_blank', 'width=800,height=600')
    })

    managementEntry.addEventListener('mouseenter', () => {
      managementEntry.style.opacity = '1'
    })

    managementEntry.addEventListener('mouseleave', () => {
      managementEntry.style.opacity = '0.8'
    })

    document.body.appendChild(managementEntry)

    // Auto-hide after 5 seconds
    setTimeout(() => {
      managementEntry.style.display = 'none'
    }, 5000)
  }
} else {
  console.log('[Emoji Userscript] Skipping injection - incompatible platform')
}
