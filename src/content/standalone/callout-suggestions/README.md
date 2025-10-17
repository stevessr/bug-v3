# Callout Suggestions Standalone Module

## 概述

这是一个独立的 Callout 自动补全模块，提供 Obsidian 风格的 Callout 语法自动补全功能。

## 文件结构

```
callout-suggestions/
├── README.md       # 本文档
├── index.ts        # 独立脚本入口点（用于注入）
└── core.ts         # 核心功能实现
```

## 功能特性

### 触发规则
- 在任何支持的编辑器中输入 `[!` 即可触发自动补全
- 支持半角和全角括号：`[`, `［`, `【`
- 感叹号可选：`!` 或 `！`

### 支持的编辑器
- 标准 `<textarea>` 元素
- ProseMirror 编辑器（Discourse 等平台使用）

### 支持的 Callout 类型

#### 信息类
- `note` 📝 - 笔记
- `abstract` / `summary` / `tldr` 📋 - 摘要
- `info` ℹ️ - 信息
- `tip` / `hint` 💡 - 提示

#### 任务类
- `todo` ☑️ - 待办事项
- `success` / `check` / `done` 🎉 - 完成

#### 疑问类
- `question` / `help` / `faq` 🤔 - 问题

#### 警告类
- `warning` / `caution` / `attention` ⚠️ - 警告
- `failure` / `fail` / `missing` ❌ - 失败
- `danger` / `error` ☠️ - 危险
- `bug` 🐛 - 错误

#### 其他类
- `example` 🔎 - 示例
- `quote` / `cite` 💬 - 引用

## 使用方式

### 1. 作为独立脚本注入

由后台脚本 (`src/background/handlers/calloutInjection.ts`) 根据用户设置动态注入到页面：

```typescript
// 当 enableCalloutSuggestions 设置为 true 时
chrome.scripting.executeScript({
  target: { tabId },
  files: ['js/callout-suggestions.js']
})
```

### 2. 直接导入使用（扩展内部）

```typescript
import { initCalloutSuggestions } from './core'

// 初始化 Callout 自动补全
initCalloutSuggestions()
```

## 技术实现

### 完全自包含
- 所有依赖函数已内联（包括样式注入）
- 编译后无需外部依赖
- 单文件大小：~11KB（压缩后 ~3.7KB）

### 防重复初始化
使用全局标记防止重复初始化：
```typescript
window.__CALLOUT_SUGGESTIONS_INITIALIZED__
```

### 样式注入
内联的 `ensureStyleInjected` 函数确保样式只注入一次：
```typescript
function ensureStyleInjected(id: string, css: string): void {
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.documentElement.appendChild(style)
}
```

### 键盘快捷键
- `↑` / `↓` - 上下选择
- `Tab` / `Enter` - 确认选择
- `Esc` - 取消

## 配置

### 用户设置
在扩展设置页面中控制：
- **设置项**: `enableCalloutSuggestions` (boolean)
- **默认值**: `false`
- **位置**: 全局设置 > Callout 自动补全

### 后台注入配置
在 `vite.config.ts` 中配置编译入口：
```typescript
input: {
  'callout-suggestions': fileURLToPath(
    new URL('src/content/standalone/callout-suggestions/index.ts', import.meta.url)
  )
}
```

## 开发说明

### 修改核心逻辑
编辑 `core.ts` 文件以修改功能实现。

### 修改入口点
编辑 `index.ts` 文件以修改初始化逻辑或添加消息监听。

### 测试
```bash
# 构建
pnpm run build

# 检查生成的文件
ls -lh dist/js/callout-suggestions.js
```

### 调试
在浏览器控制台中查找 `[CalloutSuggestions]` 前缀的日志：
```javascript
console.log('[CalloutSuggestions] Initializing standalone script')
console.log('[CalloutSuggestions] Already initialized, skipping')
console.log('[CalloutSuggestions] Received disable message, cleaning up')
```

## 版本历史

### v1.0.0 (当前)
- ✅ 完全自包含的独立脚本
- ✅ 支持 textarea 和 ProseMirror
- ✅ 26 种 Callout 类型
- ✅ 内联样式注入
- ✅ 防重复初始化
- ✅ 后台动态注入支持
- ✅ 禁用消息监听

## 相关文档

- [完整注入文档](../../../../docs/CALLOUT_SUGGESTIONS_INJECTION.md)
- [设置组件文档](../../../options/components/SettingSwitch.vue)
- [后台注入处理器](../../../background/handlers/calloutInjection.ts)
