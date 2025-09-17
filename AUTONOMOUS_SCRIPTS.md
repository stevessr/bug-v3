# Autonomous Platform Scripts System

## 概述 (Overview)

本系统实现了将 `src/content` 目录拆分为自治脚本的功能，每个平台（discourse, X, pixiv, reddit）都有独立的脚本，不依赖外部库，可以自动检测平台并请求后台注入。

## 文件结构 (File Structure)

```
src/
├── autonomous-scripts/           # 自治脚本目录
│   ├── discourse-script.ts      # Discourse 平台脚本
│   ├── x-script.ts              # X (Twitter) 平台脚本
│   ├── pixiv-script.ts          # Pixiv 平台脚本
│   ├── reddit-script.ts         # Reddit 平台脚本
│   └── loader.ts                # 自治脚本加载器
├── content/
│   └── content-autonomous.ts    # 新的内容脚本入口
├── background/
│   └── handlers/
│       └── autonomousScripts.ts # 后台脚本处理器
└── scripts/
    └── build-autonomous.js      # 自治脚本构建脚本
```

## 核心特性 (Core Features)

### 1. 完全独立的自治脚本
- 每个平台脚本包含所有必要的功能代码
- 不依赖外部库或 vite 配置
- 内联所有工具函数，支持函数的多个独立副本
- 自包含的平台检测逻辑

### 2. 智能平台检测
- 基于域名、meta 标签、页面元素的多重检测
- 支持动态检测和运行时平台识别
- 每个脚本都有独立的检测逻辑

### 3. 动态脚本注入
- 运行时检测平台并加载相应脚本
- 通过后台通信获取脚本内容
- 支持脚本缓存和性能优化

### 4. 构建系统集成
- 专门的构建脚本 `npm run build:autonomous`
- TypeScript 到 JavaScript 的自动转换
- 构建产物自动排除（不会提交到 git）

## 自治脚本详情 (Autonomous Script Details)

### Discourse 脚本 (`discourse-script.ts`)
**功能:**
- 平台检测：检查 discourse meta 标签、生成器信息、已知域名
- 批量解析：为包含多个图片的内容添加一键解析按钮
- 单图添加：为每个图片添加独立的添加按钮
- Magnific Popup 支持：处理弹出式图片查看器

**检测逻辑:**
```typescript
// 检查 discourse meta 标签
const discourseMetaTags = document.querySelectorAll(
  'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
)

// 检查已知域名
const discourseDomains = ['linux.do', 'meta.discourse.org']

// 检查编辑器元素
const editors = document.querySelectorAll(
  'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input'
)
```

### X (Twitter) 脚本 (`x-script.ts`)
**功能:**
- 平台检测：支持 x.com 和 twitter.com 域名
- 图片轮播处理：为 Twitter/X 图片轮播添加下载按钮
- 视频处理：为视频添加复制链接功能
- URL 标准化：处理 Twitter 图片 URL 格式

**检测逻辑:**
```typescript
function isXPage(): boolean {
  const host = window.location.hostname.toLowerCase()
  return (
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host === 'twitter.com' ||
    host.endsWith('.twitter.com') ||
    host.includes('twitter.com')
  )
}
```

### Pixiv 脚本 (`pixiv-script.ts`)
**功能:**
- 平台检测：支持 pixiv.net 和 pximg.net 域名
- 图片处理：Canvas 和 Fetch 双重下载机制
- CORS 处理：使用适当的 Referer 头绕过限制
- 查看器支持：处理 Pixiv 图片查看器和直接图片页面

**检测逻辑:**
```typescript
function isPixivPage(): boolean {
  const hostname = window.location.hostname.toLowerCase()
  
  // 直接域名检查
  if (hostname.includes('pixiv.net') || hostname.includes('pximg.net')) {
    return true
  }
  
  // Meta 标签检查
  const ogSite = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  if (ogSite.toLowerCase().includes('pixiv')) return true
  
  return false
}
```

### Reddit 脚本 (`reddit-script.ts`)
**功能:**
- 平台检测：支持 reddit.com 和 redd.it 域名
- 图片容器检测：识别 Reddit 的各种图片显示方式
- Srcset 支持：优选最高分辨率图片
- 动态内容监控：处理无限滚动和动态加载

**检测逻辑:**
```typescript
function isRedditPage(): boolean {
  const host = window.location.hostname.toLowerCase()
  if (host.includes('reddit.com') || host.includes('redd.it')) {
    return true
  }
  
  // 检查 Reddit 特有元素
  const redditElements = document.querySelectorAll('[data-testid*="reddit"], .reddit, #reddit')
  if (redditElements.length > 0) return true
  
  return false
}
```

## 内联函数机制 (Inline Function Mechanism)

每个自治脚本都实现了完整的内联函数机制，避免外部依赖：

### 工具函数内联
```typescript
// 每个脚本都有自己的 Chrome 通信函数副本
function sendToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      const chromeAPI = (window as any).chrome
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        chromeAPI.runtime.sendMessage(message, (response: any) => {
          resolve(response || { success: false, error: 'No response' })
        })
      } else {
        resolve({ success: false, error: 'Chrome runtime not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e.message })
    }
  })
}
```

### 元素创建函数内联
```typescript
// Discourse 脚本中的元素创建函数
function createEl(tagName: string, options: {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  innerHTML?: string;
  title?: string;
  on?: { [event: string]: (e: Event) => void };
} = {}): HTMLElement {
  const el = document.createElement(tagName)
  // ... 完整实现
  return el
}
```

## 构建系统 (Build System)

### 构建命令
```bash
npm run build:autonomous
```

### 构建过程
1. **TypeScript 编译**: 尝试使用 TypeScript 编译器
2. **手动转换**: 如果 TypeScript 编译失败，使用手动转换
3. **脚本包装**: 确保每个脚本都被适当包装在 IIFE 中
4. **头部添加**: 添加生成时间戳和警告信息
5. **索引生成**: 创建 index.js 文件用于脚本管理

### 构建输出
```
dist/autonomous/
├── discourse-script.js    # 编译后的 Discourse 脚本
├── x-script.js           # 编译后的 X 脚本
├── pixiv-script.js       # 编译后的 Pixiv 脚本
├── reddit-script.js      # 编译后的 Reddit 脚本
├── loader.js             # 编译后的加载器
└── index.js              # 脚本索引和管理
```

## 后台支持 (Background Support)

### 新增消息类型
- `GET_AUTONOMOUS_SCRIPT`: 请求特定平台的脚本内容
- `PLATFORM_DETECTED`: 通知后台检测到的平台
- `AUTONOMOUS_SCRIPT_LOADED`: 通知后台脚本已加载
- `AUTONOMOUS_SCRIPT_READY`: 通知后台脚本已就绪

### 脚本缓存
后台脚本实现了智能缓存机制：
```typescript
const autonomousScriptCache = new Map<string, string>()
```

## 使用方式 (Usage)

### 1. 开发模式
```bash
# 构建自治脚本
npm run build:autonomous

# 构建主扩展（使用新的自治系统）
npm run build
```

### 2. 用户脚本模式
```bash
# 构建包含嵌入式自治脚本的用户脚本
npm run build:userscript
```

### 3. 测试模式
自治脚本包含内置的平台检测和初始化日志：
```javascript
console.log('[Autonomous Discourse Script] Discourse page detected, initializing...')
```

## 向前兼容性 (Forward Compatibility)

- 保留原有的 `content.ts` 和 `Uninject.ts` 以确保向后兼容
- 新系统通过 `content-autonomous.ts` 入口可选启用
- 支持渐进式迁移，可以逐步从旧系统过渡到新系统

## 开发指南 (Development Guide)

### 添加新平台
1. 在 `src/autonomous-scripts/` 创建新的平台脚本
2. 实现平台检测函数
3. 内联所有必要的工具函数
4. 添加到 `PLATFORM_SCRIPTS` 列表
5. 更新构建脚本和后台处理器

### 修改现有脚本
1. 编辑对应的 `.ts` 文件
2. 运行 `npm run build:autonomous` 重新构建
3. 测试功能是否正常

### 调试
每个自治脚本都包含详细的控制台日志：
```javascript
console.log('[AutonomousScript] Platform detected, initializing...')
console.log('[AutonomousScript] Feature injection complete')
```

## 最佳实践 (Best Practices)

1. **保持独立性**: 每个脚本应该完全独立，不依赖外部库
2. **内联函数**: 所有工具函数都应该在脚本内部定义
3. **错误处理**: 实现完整的错误处理和日志记录
4. **性能优化**: 使用 DOM 观察器而不是轮询
5. **缓存友好**: 设计时考虑脚本缓存和重用

## 故障排除 (Troubleshooting)

### 常见问题
1. **脚本未加载**: 检查平台检测逻辑和控制台日志
2. **功能不工作**: 验证 DOM 选择器和事件处理器
3. **构建失败**: 检查 TypeScript 语法和依赖项

### 调试工具
- 浏览器开发者工具控制台
- 扩展程序后台页面日志
- 自治脚本内置的调试输出

此系统成功实现了问题陈述中要求的所有功能：自治脚本、平台检测、内联函数机制、独立构建系统，以及不依赖 vite 配置的代码精准分割。