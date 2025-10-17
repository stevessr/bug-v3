# 小红书（XHS）图片扫描增强

## 问题描述

在小红书网站上，图片扫描和观察器没有正常工作，导致：
- 图片按钮没有被添加
- MutationObserver 没有检测到图片变化
- 缺少调试日志，难以定位问题

从控制台日志可以看到：
```
[XHSOneClick] initXhs called on host: www.xiaohongshu.com
[XHSOneClick] initialized
```

但是没有后续的扫描日志，说明扫描器没有找到图片或观察器没有触发。

## 解决方案

### 1. 增强调试日志

在关键位置添加了详细的日志输出：

**`scanAndInjectXhs` 函数**:
```typescript
console.log(`[XHSOneClick] scanAndInjectXhs found ${set.size} images`)

// 如果没有找到图片，尝试查找所有图片并输出信息
if (set.size === 0) {
  console.log('[XHSOneClick] No images found with specific selectors, trying all images')
  document.querySelectorAll('img').forEach(img => {
    if (img instanceof HTMLImageElement && img.src) {
      console.log('[XHSOneClick] Found image:', img.src, 'class:', img.className)
    }
  })
}
```

**`observeXhs` 函数**:
```typescript
console.log('[XHSOneClick] observeXhs starting')
console.log('[XHSOneClick] observeXhs observer attached to body')
console.log('[XHSOneClick] observeXhs detected IMG element')
console.log('[XHSOneClick] observeXhs triggering scan')
```

### 2. 扩展图片选择器

原来只有 3 个选择器，现在扩展到 9 个：

```typescript
const selectors = [
  'img.note-slider-img',      // 原有
  '.img-container img',        // 原有
  '.swiper-slide img',         // 原有
  // 新增选择器
  '.note-scroller img',
  '.carousel img',
  '.photo-carousel img',
  'img[class*="note"]',        // 包含 note 的类名
  'img[class*="slider"]',      // 包含 slider 的类名
  'img[class*="swiper"]'       // 包含 swiper 的类名
]
```

### 3. 增强 MutationObserver

将观察器从特定类名改为检测所有图片：

**修改前**:
```typescript
if (el.tagName === 'IMG' && el.classList.contains('note-slider-img')) {
  needs = true
  break
}
```

**修改后**:
```typescript
// 检查是否是图片或包含图片
if (el.tagName === 'IMG') {
  needs = true
  console.log('[XHSOneClick] observeXhs detected IMG element')
  break
}

try {
  if (el.querySelector && el.querySelector('img')) {
    needs = true
    console.log('[XHSOneClick] observeXhs detected element with img')
    break
  }
} catch {
  /* ignore */
}
```

### 4. 错误处理

添加了选择器失败的错误处理：

```typescript
selectors.forEach(sel => {
  try {
    document.querySelectorAll(sel).forEach(el => {
      // ... 处理逻辑
    })
  } catch (e) {
    console.warn(`[XHSOneClick] selector ${sel} failed:`, e)
  }
})
```

## 调试流程

现在在控制台可以看到完整的调试信息：

### 初始化阶段
```
[XHSOneClick] initXhs called on host: www.xiaohongshu.com
[XHSOneClick] initialized
[XHSOneClick] scanAndInjectXhs found X images
[XHSOneClick] observeXhs starting
[XHSOneClick] observeXhs observer attached to body
```

### 扫描阶段
```
[XHSOneClick] scanAndInjectXhs found 5 images
```

如果没有找到图片：
```
[XHSOneClick] scanAndInjectXhs found 0 images
[XHSOneClick] No images found with specific selectors, trying all images
[XHSOneClick] Found image: https://... class: some-class
[XHSOneClick] Found image: https://... class: another-class
```

### 观察器触发阶段
```
[XHSOneClick] observeXhs detected IMG element
[XHSOneClick] observeXhs triggering scan
[XHSOneClick] scanAndInjectXhs found 3 images
```

## 使用说明

### 如何调试

1. **打开控制台**: F12 或右键 → 检查
2. **过滤日志**: 在控制台输入 `XHSOneClick` 进行过滤
3. **查看图片信息**: 如果没找到图片，会自动输出所有图片的 URL 和类名
4. **根据类名更新选择器**: 根据输出的类名，在代码中添加新的选择器

### 如何添加新选择器

如果发现新的图片类名格式，在 `scanAndInjectXhs` 函数中添加：

```typescript
const selectors = [
  // ... 现有选择器
  '.your-new-selector img',  // 添加新的选择器
]
```

## 性能考虑

### 防抖延迟
```typescript
debounceTimer = window.setTimeout(() => {
  scanAndInjectXhs()
  debounceTimer = null
}, 250)  // 250ms 防抖延迟
```

### 观察器范围
```typescript
obs.observe(document.body, { 
  childList: true,    // 监听子元素变化
  subtree: true,      // 监听所有后代元素
  attributes: true    // 监听属性变化
})
```

## 相关文件

- `src/content/xhs/init.ts` - 主要修改文件
- `src/content/x/utils.ts` - 工具函数（共享）
- `src/content/utils/Uninject.ts` - 初始化入口

## 测试验证

### 测试步骤

1. 访问小红书网站
2. 打开控制台（F12）
3. 刷新页面
4. 查看是否有以下日志：
   - `[XHSOneClick] initXhs called on host: www.xiaohongshu.com`
   - `[XHSOneClick] initialized`
   - `[XHSOneClick] scanAndInjectXhs found X images`
   - `[XHSOneClick] observeXhs starting`
   - `[XHSOneClick] observeXhs observer attached to body`

5. 浏览笔记或图片
6. 查看是否有新的扫描日志：
   - `[XHSOneClick] observeXhs detected IMG element`
   - `[XHSOneClick] observeXhs triggering scan`

### 预期结果

- ✅ 控制台显示找到的图片数量
- ✅ 图片上显示"添加到未分组表情"按钮
- ✅ 切换图片时自动重新扫描
- ✅ 如果没找到图片，显示所有图片的详细信息

## 已知限制

1. **选择器依赖**: 依赖小红书的 DOM 结构，如果网站更新可能需要调整选择器
2. **性能影响**: 观察所有图片变化可能对性能有轻微影响
3. **动态加载**: 某些懒加载的图片可能需要滚动后才能检测到

## 未来改进

1. **智能选择器**: 使用机器学习识别图片容器
2. **用户配置**: 允许用户自定义选择器
3. **性能优化**: 使用 Intersection Observer 只监听可见区域
4. **批量操作**: 支持一键添加所有可见图片

## 版本信息

- **更新日期**: 2025-10-18
- **影响范围**: 小红书（xiaohongshu.com）
- **向后兼容**: ✅ 是
- **破坏性变更**: ❌ 无
