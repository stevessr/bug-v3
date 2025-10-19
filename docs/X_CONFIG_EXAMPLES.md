# X 图片注入配置示例

## 快速配置指南

修改 `src/content/x/xConfig.ts` 文件中的配置项来控制不同场景的图片注入功能。

## 场景说明

### 🎠 轮播图 (Carousel)
- **配置项**: `enableCarousel`
- **场景**: 推文中的多图轮播查看器
- **选择器**: `[role="group"][aria-roledescription="carousel"]`

### 🐦 推文图片 (Tweet Images)
- **配置项**: `enableTweetImages`
- **场景**: 时间线和个人页面的推文图片
- **选择器**: `article[data-testid="tweet"]` 中的图片元素

### 🔲 对话框图片 (Dialog Images)
- **配置项**: `enableDialogImages`
- **场景**: 点击图片后的全屏查看对话框
- **选择器**: `[role="dialog"]`, `[aria-modal="true"]`

### 📋 列表项图片 (List Item Images)
- **配置项**: `enableListItemImages`
- **场景**: 某些列表视图中的图片
- **选择器**: `li[role="listitem"]`

### 👆 滑动关闭 (Swipe to Dismiss)
- **配置项**: `enableSwipeToDismissImages`
- **场景**: 可滑动关闭的图片查看器
- **选择器**: `[data-testid="swipe-to-dismiss"]`

### 🖼️ 独立媒体页面 (Standalone Media)
- **配置项**: `enableStandaloneMediaImages`
- **场景**: 在新标签页直接打开 Twitter 图片链接
- **检测**: 访问 `pbs.twimg.com` 域名时

---

## 常用配置示例

### ✅ 默认配置（全部启用）

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: true,
    enableTweetImages: true,
    enableDialogImages: true,
    enableListItemImages: true,
    enableSwipeToDismissImages: true,
    enableStandaloneMediaImages: true,
  },
} as const
```

**适用场景**: 希望在所有可能的地方都显示"添加表情"按钮

---

### 🎯 仅推文图片

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,
    enableTweetImages: true,     // ← 只启用这个
    enableDialogImages: false,
    enableListItemImages: false,
    enableSwipeToDismissImages: false,
    enableStandaloneMediaImages: false,
  },
} as const
```

**适用场景**: 
- 只想在时间线浏览推文时添加表情
- 不希望在查看大图时被按钮干扰

---

### 🖼️ 仅全屏查看

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,
    enableTweetImages: false,
    enableDialogImages: true,    // ← 对话框
    enableListItemImages: false,
    enableSwipeToDismissImages: true,  // ← 滑动查看器
    enableStandaloneMediaImages: true, // ← 独立页面
  },
} as const
```

**适用场景**: 
- 只在查看大图/全屏时才需要添加表情功能
- 减少时间线上的视觉干扰

---

### 🚫 完全禁用

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,
    enableTweetImages: false,
    enableDialogImages: false,
    enableListItemImages: false,
    enableSwipeToDismissImages: false,
    enableStandaloneMediaImages: false,
  },
} as const
```

**适用场景**: 
- 完全关闭 X 平台的图片注入功能
- 用于调试或临时禁用

---

### ⚡ 性能优先（最小化）

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,
    enableTweetImages: true,     // 只保留最常用的
    enableDialogImages: true,    // 和必要的场景
    enableListItemImages: false,
    enableSwipeToDismissImages: false,
    enableStandaloneMediaImages: false,
  },
} as const
```

**适用场景**: 
- 希望减少 DOM 查询和注入操作
- 只保留最常用的场景以提升性能

---

### 🎨 避免对话框干扰

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: true,
    enableTweetImages: true,
    enableDialogImages: false,   // ← 禁用对话框
    enableListItemImages: true,
    enableSwipeToDismissImages: false,  // ← 禁用滑动查看器
    enableStandaloneMediaImages: true,
  },
} as const
```

**适用场景**: 
- 不希望在全屏查看图片时显示按钮
- 保持查看体验的简洁性

---

## 修改后如何应用

1. **编辑配置文件**
   ```bash
   vim src/content/x/xConfig.ts
   ```

2. **重新构建项目**
   ```bash
   pnpm run build
   ```

3. **重新加载扩展**
   - Chrome: 访问 `chrome://extensions/`，点击"重新加载"
   - Firefox: 访问 `about:debugging#/runtime/this-firefox`，点击"重新加载"

---

## 性能提示

禁用不需要的场景可以：
- ✅ 减少 DOM 查询次数
- ✅ 降低 MutationObserver 的处理负担
- ✅ 减少按钮元素的创建和管理
- ✅ 提升页面性能和响应速度

---

## 调试技巧

1. **查看控制台日志**
   ```
   [XImages] All image injection types disabled
   [XCarousel] Image injection disabled by config
   ```

2. **检查元素类名**
   - 已注入: 包含 `.injected` 类名
   - 按钮: 查找 `.x-emoji-add-btn-carousel` 元素

3. **使用开发者工具**
   - 检查元素的 `data-testid` 属性
   - 确认元素的父级选择器
   - 验证按钮是否被正确创建

---

## 常见问题

**Q: 修改配置后没有生效？**
A: 确保重新构建了项目并重新加载了浏览器扩展。

**Q: 如何知道某个图片属于哪个类型？**
A: 使用浏览器开发者工具检查元素，查看其父级元素的属性：
- 包含 `[role="dialog"]` → Dialog
- 包含 `article[data-testid="tweet"]` → Tweet
- 包含 `[role="group"][aria-roledescription="carousel"]` → Carousel

**Q: 能不能动态切换配置？**
A: 当前配置是编译时确定的 `const`，无法在运行时修改。如需动态配置，可以考虑使用 Chrome Storage API。

**Q: 禁用某个类型会影响其他类型吗？**
A: 不会。每个类型都是独立控制的，互不影响。

---

## 相关文档

- [完整功能说明](./X_IMAGE_INJECTION_SWITCH.md)
- [代码结构文档](./X_CODE_STRUCTURE.md)
