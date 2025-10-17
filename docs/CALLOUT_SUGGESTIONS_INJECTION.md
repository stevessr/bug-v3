# Callout Suggestions 独立脚本注入

## 概述

Callout 自动补全功能现在已改造为独立的自治脚本，由后台根据用户设置动态注入到页面中。

## 架构设计

### 1. 独立脚本模块
- **目录**: `src/content/standalone/callout-suggestions/`
- **入口文件**: `index.ts` - 独立脚本入口点
- **核心文件**: `core.ts` - Callout 功能核心逻辑
- **编译输出**: `dist/js/callout-suggestions.js` (~11KB)
- **功能**: 提供 Obsidian 风格的 Callout 语法自动补全（输入 `[!` 时触发）
- **特点**: 完全自包含，已内联所有依赖函数（包括样式注入）

### 2. Content Script 智能请求
- **文件**: `src/content/content.ts`
- **功能**:
  - 检测页面平台类型（Discourse、Flarum 等）
  - 读取用户设置 `enableCalloutSuggestions`
  - 向 Background 发送注入请求

### 3. 后台注入逻辑
- **文件**: `src/background/handlers/calloutInjection.ts`
- **功能**:
  - 处理 Content Script 的注入请求 (`INJECT_CALLOUT_SUGGESTIONS`)
  - 监听用户设置变化
  - 根据设置动态注入/移除脚本到所有标签页

### 4. 设置管理
- **设置项**: `enableCalloutSuggestions` (boolean)
- **默认值**: `false`
- **位置**: 全局设置 > Callout 自动补全

## 工作流程

### 页面加载时的智能注入（按需加载）

```
用户访问页面
    ↓
Content Script 加载
    ↓
检测页面平台 ──→ 不支持的平台 ──→ 跳过
    ↓ 支持的平台
读取设置 enableCalloutSuggestions
    ↓
设置为 true? ──→ false ──→ 跳过
    ↓ true
发送消息: INJECT_CALLOUT_SUGGESTIONS
    ↓
Background 收到请求
    ↓
注入 callout-suggestions.js
    ↓
脚本初始化
    ↓
监听用户输入 [!
```

**详细步骤**:
1. 用户访问页面，Content script 加载
2. Content script 检测页面是否为支持的平台（Discourse 等）
3. 如果平台支持，Content script 请求后台读取 `enableCalloutSuggestions` 设置
4. 如果设置为 `true`，Content script 向 Background 发送 `INJECT_CALLOUT_SUGGESTIONS` 消息
5. Background 收到请求后，向当前标签页注入 `callout-suggestions.js`
6. 脚本在页面中初始化，开始监听用户输入

### 用户启用功能
1. 用户在设置页面开启 "启用 Callout 自动补全"
2. Background 检测到设置变化
3. Background 遍历所有打开的标签页，向每个标签页注入脚本

### 用户禁用功能
1. 用户在设置页面关闭 "启用 Callout 自动补全"
2. Background 检测到设置变化
3. Background 向所有已注入的标签页发送 `DISABLE_CALLOUT_SUGGESTIONS` 消息
4. 脚本收到消息后隐藏建议框并标记为未初始化

## 技术细节

### 消息通信

#### Content → Background
```typescript
// 请求注入 Callout Suggestions
chrome.runtime.sendMessage({
  type: 'INJECT_CALLOUT_SUGGESTIONS',
  tabId: 'current'
}, response => {
  // response: { success: boolean, error?: string }
})
```

#### Background → Content (已注入的脚本)
```typescript
// 禁用 Callout Suggestions
chrome.tabs.sendMessage(tabId, {
  type: 'DISABLE_CALLOUT_SUGGESTIONS'
})
```

### 防重复注入
- 使用 `window.__CALLOUT_SUGGESTIONS_INITIALIZED__` 标记防止重复初始化
- 后台维护 `injectedTabs` Set 跟踪已注入的标签页
- Content script 在请求注入前检查是否已启用设置

### 特殊页面过滤
- 自动跳过 `chrome://` 和 `edge://` 等特殊页面
- 仅注入到用户访问的正常网页

### 支持的编辑器
- `<textarea>` 元素
- ProseMirror 编辑器（Discourse 等平台使用）

### 触发规则
- 支持半角和全角括号: `[`, `［`, `【`
- 感叹号可选: `!` 或 `！`
- 实时过滤关键词匹配

## 构建配置

### vite.config.ts 修改
```typescript
input: {
  // ... 其他入口
  'callout-suggestions': fileURLToPath(
    new URL('src/standalone/callout-suggestions.ts', import.meta.url)
  )
}
```

### manifest.json 权限
已有的权限足够支持脚本注入：
- `scripting`: 允许动态注入脚本
- `tabs`: 允许访问标签页信息
- `storage`: 允许读取用户设置

## 与旧实现的区别

### 旧实现（已移除）
- Callout 功能直接在 `discourse.ts` 中初始化
- 每次页面加载都需要检查设置
- 与其他 Discourse 功能耦合
- Background 盲目监听所有标签页更新

### 新实现（智能按需注入）
- ✅ **Content Script 主动请求**: 只有在支持的平台上才请求注入
- ✅ **按需加载**: 减少不必要的脚本注入和资源消耗
- ✅ **平台检测**: Content script 智能识别支持的编辑器
- ✅ **解耦独立**: 独立脚本模块，易于维护和扩展
- ✅ **支持通用**: 支持所有网站，不限于 Discourse
- ✅ **性能优化**: Background 不再监听所有标签页，减少开销

## 文件清单

### 新增目录和文件
- `src/content/standalone/callout-suggestions/` - Callout 功能模块目录
  - `index.ts` - 独立脚本入口点
  - `core.ts` - 核心功能逻辑（已内联 `ensureStyleInjected`）
- `src/background/handlers/calloutInjection.ts` - 后台注入逻辑处理器
- `docs/CALLOUT_SUGGESTIONS_INJECTION.md` - 本文档

### 修改文件
- `vite.config.ts` - 更新编译入口路径
- `src/background/background.ts` - 注册注入监听器

### 移除文件
- `src/content/discourse/callout-suggestions.ts` - 已移至新目录
- `src/standalone/callout-suggestions.ts` - 已移至新目录

### 相关文件
- `src/content/discourse/discourse.ts` - 已移除直接调用 callout 功能
- `src/options/components/GlobalSettings.vue` - 设置界面（已使用 SettingSwitch 组件）

## 调试说明

### 查看注入状态
1. 打开浏览器控制台
2. 查找 `[CalloutInjection]` 前缀的日志
3. 查看注入成功/失败消息

### 测试功能
1. 在任意支持的编辑器中输入 `[!`
2. 应该看到 Callout 关键词建议框
3. 使用方向键或鼠标选择关键词
4. 按 Enter 或 Tab 完成输入

### 常见问题
- **脚本未注入**: 检查设置是否开启，查看后台日志
- **建议框不显示**: 检查页面是否有支持的编辑器元素
- **重复初始化**: 检查 `__CALLOUT_SUGGESTIONS_INITIALIZED__` 标记

## 代码优化

### 内联依赖
为了使 `callout-suggestions.js` 完全自包含，我们将 `ensureStyleInjected` 函数直接内联到了 `callout-suggestions.ts` 中：

```typescript
// Internal style injection helper (inlined to avoid external dependencies)
function ensureStyleInjected(id: string, css: string): void {
  // Check if style already exists
  if (document.getElementById(id)) {
    return
  }
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.documentElement.appendChild(style)
}
```

**优势**:
- 减少了对外部模块的依赖
- 避免生成额外的 `injectStyles.js` 文件
- 使独立脚本更易于分发和调试
- 文件大小仅增加约 110 字节

## 未来改进

1. **性能优化**
   - 仅在检测到编辑器元素时注入
   - 使用 Intersection Observer 延迟初始化

2. **自定义规则**
   - 允许用户添加自定义 Callout 类型
   - 支持自定义图标和颜色

3. **更多平台支持**
   - 测试并优化其他富文本编辑器
   - 支持更多内容管理系统

4. **智能注入**
   - 根据网站域名白名单注入
   - 自动检测页面是否有编辑器
