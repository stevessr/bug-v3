# Intelligent Platform Script Injection System

## 概述 (Overview)

本系统实现了智能平台脚本注入功能，通过 `chrome.scripting.executeScript` API 动态注入平台特定的脚本。系统整合到主构建流程中，不再需要独立的构建命令。

## 核心特性 (Core Features)

### 1. 智能脚本注入
- 使用 Chrome Manifest V3 的 `chrome.scripting.executeScript` API
- 脚本在隔离环境中运行，具有 Chrome API 访问权限
- 动态检测平台并注入相应的脚本

### 2. 集成构建系统
- 平台脚本集成到主 vite 构建中
- 单一 `npm run build` 命令构建所有内容
- 自动生成独立的平台脚本文件

### 3. 平台特定脚本
- **discourse**: `content-discourse.js` (6.28 kB)
- **x**: `content-x.js` (7.54 kB) 
- **pixiv**: `content-pixiv.js` (7.80 kB)
- **reddit**: `content-reddit.js` (5.84 kB)

## 架构设计 (Architecture)

### 智能内容脚本 (`content-smart.ts`)
主内容脚本负责：
- 平台检测
- 向背景脚本请求注入
- 处理 CSRF 令牌（linux.do 兼容性）

```typescript
async function requestPlatformInjection(platform: string): Promise<boolean> {
  const response = await sendToBackground({
    type: 'INJECT_PLATFORM_SCRIPT',
    platform: platform,
    url: window.location.href
  })
  return response.success
}
```

### 背景脚本注入处理器
使用 `chrome.scripting.executeScript` 进行动态注入：

```typescript
export async function handleInjectPlatformScript(
  platform: string,
  url: string,
  sender: any,
  sendResponse: (response: any) => void
): Promise<void> {
  const scriptFiles: { [key: string]: string } = {
    'discourse': 'content-discourse.js',
    'x': 'content-x.js',
    'pixiv': 'content-pixiv.js',
    'reddit': 'content-reddit.js'
  }
  
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [`js/${scriptFile}`],
    world: 'ISOLATED', // 在隔离环境中运行，可访问 Chrome API
    injectImmediately: false
  })
}
```

### 平台脚本特性
每个平台脚本：
- 独立运行，不需要 IIFE 包装
- 具有完整的 Chrome API 访问权限
- 包含内联的所有必要功能
- 自动检测并初始化平台功能

## 构建集成 (Build Integration)

### Vite 配置更新
```typescript
input: {
  // 主要入口点
  content: fileURLToPath(new URL('src/content/content-smart.ts', import.meta.url)),
  background: fileURLToPath(new URL('src/background/background.ts', import.meta.url)),
  
  // 平台特定注入脚本
  'content-discourse': fileURLToPath(new URL('src/autonomous-scripts/discourse-script.ts', import.meta.url)),
  'content-x': fileURLToPath(new URL('src/autonomous-scripts/x-script.ts', import.meta.url)),
  'content-pixiv': fileURLToPath(new URL('src/autonomous-scripts/pixiv-script.ts', import.meta.url)),
  'content-reddit': fileURLToPath(new URL('src/autonomous-scripts/reddit-script.ts', import.meta.url))
}
```

### 构建输出
```
dist/js/
├── content.js           # 智能检测和注入脚本 (60.04 kB)
├── background.js        # 背景脚本 (18.19 kB)
├── content-discourse.js # Discourse 平台脚本 (6.28 kB)
├── content-x.js         # X/Twitter 平台脚本 (7.54 kB)
├── content-pixiv.js     # Pixiv 平台脚本 (7.80 kB)
└── content-reddit.js    # Reddit 平台脚本 (5.84 kB)
```

## 使用方法 (Usage)

### 开发和构建
```bash
# 构建所有内容（包括平台脚本）
npm run build

# 开发模式
npm run dev
```

### 消息处理
背景脚本处理的新消息类型：
- `INJECT_PLATFORM_SCRIPT`: 请求注入平台特定脚本
- `PLATFORM_DETECTED`: 平台检测通知
- `AUTONOMOUS_SCRIPT_READY`: 脚本就绪通知

## Chrome API 访问

注入的脚本在 `ISOLATED` 世界中运行，具有完整的 Chrome 扩展 API 访问权限：

```typescript
// 平台脚本中可以直接使用 Chrome API
function sendToBackground(message: any): Promise<any> {
  return new Promise(resolve => {
    const chromeAPI = chrome // 直接访问 Chrome API
    if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
      chromeAPI.runtime.sendMessage(message, response => {
        resolve(response || { success: false, error: 'No response' })
      })
    }
  })
}
```

## 平台检测逻辑

智能内容脚本使用多层检测：

```typescript
function detectPlatform(): 'discourse' | 'x' | 'pixiv' | 'reddit' | 'emoji' | 'unknown' {
  const hostname = window.location.hostname.toLowerCase()
  
  // X (Twitter) 检测
  if (hostname === 'x.com' || hostname.includes('twitter.com')) {
    return 'x'
  }
  
  // Pixiv 检测
  if (hostname.includes('pixiv.net') || hostname.includes('pximg.net')) {
    return 'pixiv'
  }
  
  // Reddit 检测
  if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
    return 'reddit'
  }
  
  // Discourse 检测 - 多重验证
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    return 'discourse'
  }
  
  // 其他检测逻辑...
}
```

## 优势对比

### 之前的自治脚本系统
- ❌ 独立构建命令 (`npm run build:autonomous`)
- ❌ 复杂的脚本内容传递机制
- ❌ IIFE 包装导致的作用域限制
- ❌ 构建产物需要手动管理

### 现在的智能注入系统
- ✅ 集成到主构建流程
- ✅ 使用标准 Chrome API (`chrome.scripting.executeScript`)
- ✅ 脚本具有完整 Chrome API 访问权限
- ✅ 自动化脚本管理和注入
- ✅ 更小的主内容脚本体积 (60.04 kB vs 107.80 kB)
- ✅ 按需加载平台特定功能

## 技术实现细节

### 脚本注入时机
- `injectImmediately: false`: 等待文档准备就绪
- `world: 'ISOLATED'`: 在隔离环境中运行，具有 Chrome API 访问
- 错误处理和重试机制

### 性能优化
- 主内容脚本大小减少 44%
- 平台脚本按需加载
- 智能缓存和重用机制

这个新系统完全满足了用户的要求：构建集成、智能注入、Chrome API 访问，同时保持了代码的模块化和可维护性。