# Callout Suggestions 独立脚本注入

## 概述

Callout 自动补全功能现在已改造为独立的自治脚本，由后台根据用户设置动态注入到页面中。

## 架构设计

### 1. 独立脚本
- **文件**: `src/standalone/callout-suggestions.ts`
- **编译输出**: `dist/js/callout-suggestions.js` (~11KB)
- **功能**: 提供 Obsidian 风格的 Callout 语法自动补全（输入 `[!` 时触发）
- **特点**: 完全自包含，已内联所有依赖函数（包括样式注入）

### 2. 后台注入逻辑
- **文件**: `src/background/handlers/calloutInjection.ts`
- **功能**:
  - 监听用户设置变化
  - 监听标签页更新
  - 根据 `enableCalloutSuggestions` 设置动态注入/移除脚本

### 3. 设置管理
- **设置项**: `enableCalloutSuggestions` (boolean)
- **默认值**: `false`
- **位置**: 全局设置 > Callout 自动补全

## 工作流程

### 启用流程
1. 用户在设置页面开启 "启用 Callout 自动补全"
2. 后台检测到设置变化
3. 后台遍历所有打开的标签页
4. 向每个符合条件的标签页注入 `callout-suggestions.js`
5. 脚本在页面中初始化，开始监听用户输入

### 禁用流程
1. 用户在设置页面关闭 "启用 Callout 自动补全"
2. 后台检测到设置变化
3. 后台向所有已注入的标签页发送 `DISABLE_CALLOUT_SUGGESTIONS` 消息
4. 脚本收到消息后隐藏建议框并标记为未初始化

### 新标签页流程
1. 用户打开新标签页或导航到新页面
2. 后台监听到 `tabs.onUpdated` 事件
3. 检查当前 `enableCalloutSuggestions` 设置
4. 如果启用，自动注入脚本到新页面

## 技术细节

### 防重复注入
- 使用 `window.__CALLOUT_SUGGESTIONS_INITIALIZED__` 标记防止重复初始化
- 后台维护 `injectedTabs` Set 跟踪已注入的标签页

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

### 新实现
- 独立脚本，按需注入
- 后台统一管理注入逻辑
- 支持所有网站，不限于 Discourse
- 更好的性能和可维护性

## 文件清单

### 新增文件
- `src/standalone/callout-suggestions.ts` - 独立脚本入口
- `src/background/handlers/calloutInjection.ts` - 注入逻辑处理器
- `docs/CALLOUT_SUGGESTIONS_INJECTION.md` - 本文档

### 修改文件
- `vite.config.ts` - 添加新入口
- `src/background/background.ts` - 注册注入监听器
- `src/content/discourse/discourse.ts` - 移除直接调用

### 核心功能文件
- `src/content/discourse/callout-suggestions.ts` - 核心功能逻辑
  - 已内联 `ensureStyleInjected` 函数，移除外部依赖
  - 被独立脚本引用
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
