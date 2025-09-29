# Bilibili 图片查看器 - 添加表情按钮实现

## 概述

基于现有的 Bilibili 动态内容脚本，为图片查看器的控制面板（`.bili-album__watch__control`）添加了一个新的"添加表情"按钮，允许用户将当前显示的图片保存为表情。

## 实现特性

### 1. 按钮设计

- **位置**: 集成到现有的 `.bili-album__watch__control` 控制面板中
- **图标**: 14x14px SVG 笑脸图标，与现有按钮保持一致
- **文本**: 中文标签"添加表情"
- **样式**: 与现有控制按钮相同的样式和布局
- **CSS类**: `.bili-album__watch__control__option.add-emoji`

### 2. 功能特性

- ✅ 自动检测当前显示的图片
- ✅ 提取图片URL并生成合适的文件名
- ✅ 与现有的表情添加系统集成
- ✅ 成功/失败状态的视觉反馈
- ✅ 防止重复添加按钮
- ✅ 悬停效果和过渡动画

## 代码实现

### 新增函数

#### 1. `createControlButton(data: AddEmojiButtonData)`

创建符合 Bilibili 控制面板样式的按钮：

```typescript
function createControlButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('div')
  btn.className = 'bili-album__watch__control__option add-emoji'
  btn.title = '添加到未分组表情'

  // 14x14px 笑脸SVG图标
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('width', '14')
  icon.setAttribute('height', '14')
  icon.setAttribute('viewBox', '0 0 14 14')
  icon.innerHTML = `<path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7z..."/>`

  const text = document.createElement('span')
  text.textContent = '添加表情'

  btn.appendChild(icon)
  btn.appendChild(text)

  setupButtonClickHandler(btn, data)
  return btn
}
```

#### 2. `getCurrentDisplayedImage()`

查找当前在查看器中显示的图片：

```typescript
function getCurrentDisplayedImage(): Element | null {
  const selectors = [
    '.bili-album__watch__content img',
    '.bili-album__watch__content picture',
    '.bili-album__watch__content .bili-album__preview__picture__img',
    '.bili-album__watch__content [style*="background-image"]'
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      const url = extractImageUrlFromPicture(element)
      if (url) return element
    }
  }

  return null
}
```

#### 3. `addButtonToControlSection(controlSection: Element)`

将按钮添加到控制面板：

```typescript
function addButtonToControlSection(controlSection: Element) {
  // 检查是否已存在按钮
  if (controlSection.querySelector('.add-emoji')) return

  // 查找当前显示的图片
  const currentImage = getCurrentDisplayedImage()
  if (!currentImage) return

  const url = extractImageUrlFromPicture(currentImage)
  if (!url) return

  const name = extractNameFromUrl(url)
  const btn = createControlButton({ name, url })

  controlSection.appendChild(btn)
}
```

### 更新的函数

#### `scanAndInject()`

添加了对控制面板的扫描：

```typescript
function scanAndInject() {
  // 现有的图片容器处理...

  // 新增：添加按钮到控制面板
  const controlSections = document.querySelectorAll('.bili-album__watch__control')
  controlSections.forEach(controlSection => {
    addButtonToControlSection(controlSection)
  })

  // 现有的批量解析按钮处理...
}
```

## HTML 结构示例

```html
<div class="bili-album__watch__control">
  <!-- 现有按钮 -->
  <div class="bili-album__watch__control__option">
    <svg width="14" height="14">...</svg>
    <span>收起</span>
  </div>
  <div class="bili-album__watch__control__option">
    <svg width="14" height="14">...</svg>
    <span>查看大图</span>
  </div>
  <div class="bili-album__watch__control__option">
    <svg width="14" height="14">...</svg>
    <span>向左旋转</span>
  </div>
  <div class="bili-album__watch__control__option">
    <svg width="14" height="14">...</svg>
    <span>向右旋转</span>
  </div>

  <!-- 新添加的表情按钮 -->
  <div class="bili-album__watch__control__option add-emoji">
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path
        d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zM5.5 4.5c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm3 0c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zM7 11c-1.657 0-3-1.343-3-3h6c0 1.657-1.343 3-3 3z"
      />
    </svg>
    <span>添加表情</span>
  </div>
</div>
```

## CSS 样式

```css
.bili-album__watch__control__option.add-emoji {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.2s ease;
  user-select: none;
}

.bili-album__watch__control__option.add-emoji:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

## 使用方式

1. 用户在 Bilibili 动态页面打开图片查看器
2. 在控制面板中会自动出现"添加表情"按钮
3. 点击按钮将当前显示的图片保存为表情
4. 按钮会显示成功或失败的视觉反馈

## 技术细节

- **兼容性**: 与现有的 Bilibili 内容脚本完全兼容
- **性能**: 使用现有的 MutationObserver 进行动态检测
- **错误处理**: 包含完整的错误处理和日志记录
- **样式一致性**: 完全匹配 Bilibili 原生控制按钮的外观和行为

## PhotoSwipe 顶部栏按钮实现

### 新增功能

除了控制面板按钮外，还为 PhotoSwipe 图片查看器的顶部栏添加了专门的按钮：

#### 1. `createPhotoSwipeButton(data: AddEmojiButtonData)`

创建符合 PhotoSwipe 样式的按钮：

```typescript
function createPhotoSwipeButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'pswp__button bili-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'

  // PhotoSwipe 按钮样式，匹配现有按钮
  btn.style.cssText = `
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
    background: none;
    border: none;
    cursor: pointer;
    overflow: visible;
    appearance: none;
    box-shadow: none;
    opacity: 0.75;
    transition: opacity 0.2s;
    color: #fff;
    font-size: 18px;
    line-height: 44px;
    text-align: center;
  `

  btn.innerHTML = '➕'
  setupButtonClickHandler(btn, data)
  return btn
}
```

#### 2. 改进的 `addButtonToPhotoSwipeTopBar()`

精确定位按钮到关闭按钮旁边：

```typescript
function addButtonToPhotoSwipeTopBar(name: string, url: string): boolean {
  const topBar = document.querySelector('.pswp__top-bar')
  if (!topBar || topBar.querySelector('.bili-emoji-add-btn')) return false

  // 找到关闭按钮以便在其旁边定位我们的按钮
  const closeButton = topBar.querySelector('.pswp__button--close')
  if (!closeButton) return false

  // 创建 PhotoSwipe 样式的按钮
  const btn = createPhotoSwipeButton({ name, url })

  // 在关闭按钮之前插入按钮
  topBar.insertBefore(btn, closeButton)
  return true
}
```

### PhotoSwipe 按钮特性

- **精确定位**: 使用 `insertBefore()` 将按钮定位在关闭按钮旁边
- **原生样式**: 完全匹配 PhotoSwipe 的按钮样式和尺寸 (44x44px)
- **悬停效果**: 透明度从 0.75 变为 1.0，与其他按钮一致
- **图标设计**: 使用 ➕ 表情符号，简洁明了
- **无缝集成**: 看起来像 PhotoSwipe 的原生按钮

### HTML 结构示例

```html
<div class="pswp__top-bar">
  <div class="pswp__counter">1 / 5</div>
  <button class="pswp__button pswp__button--zoom">🔍</button>

  <!-- 我们注入的按钮 -->
  <button class="pswp__button bili-emoji-add-btn" title="添加到未分组表情">➕</button>

  <button class="pswp__button pswp__button--close">✕</button>
</div>
```

## 样式一致性和URL解析修复

### 问题修复

#### 问题1: 按钮样式不一致

**原因**: 过多的内联样式覆盖了 Bilibili 的原生 CSS，导致视觉不一致。

**解决方案**:

1. **移除过多内联样式**: 只保留必要的 `cursor: pointer` 样式
2. **CSS 继承修复**: 注入 CSS 确保按钮继承 Bilibili 的原生样式
3. **悬停状态修复**: 移除自定义悬停效果，让原生 CSS 处理

```typescript
// 修复前（有问题）
btn.style.cssText = `cursor:pointer;display:flex;align-items:center;gap:4px;padding:8px 12px;border-radius:6px;background:rgba(255,255,255,0.1);color:#fff;font-size:12px;font-weight:500;transition:background-color 0.2s ease;user-select:none;`

// 修复后（正确）
btn.style.cssText = 'cursor: pointer;' // 只保留必要样式
```

#### 问题2: URL解析问题

**原因**: 图片检测选择器不够全面，无法覆盖所有 Bilibili 图片查看器场景。

**解决方案**:

1. **扩展选择器列表**: 添加更多图片容器选择器
2. **改进URL提取**: 支持多种属性和背景图片
3. **URL验证**: 验证提取的URL是否为有效的图片URL

```typescript
// 扩展的选择器列表
const selectors = [
  '.bili-album__watch__content img',
  '.bili-album__watch__content picture',
  '.bili-album__watch__track__item.active img',
  '.bili-album__preview__picture img',
  '.bili-album__watch__main img',
  '.bili-album img[src*="i0.hdslb.com"]',
  'img[src*="hdslb.com"]'
  // ... 更多选择器
]
```

### 注入的CSS修复

```css
.bili-album__watch__control__option.add-emoji {
  background: inherit !important; /* 继承背景 */
  color: inherit !important; /* 继承文字颜色 */
  font-size: inherit !important; /* 继承字体大小 */
  font-weight: inherit !important; /* 继承字体粗细 */
  padding: inherit !important; /* 继承内边距 */
  border-radius: inherit !important; /* 继承圆角 */
  transition: inherit !important; /* 继承过渡效果 */

  /* 只指定绝对必要的样式 */
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  cursor: pointer !important;
  user-select: none !important;
}

.bili-album__watch__control__option.add-emoji:hover {
  background: inherit !important; /* 让原生CSS处理悬停 */
  color: inherit !important;
}
```

### URL提取改进

```typescript
// 多种URL提取方法
const urlSources = [
  // 1. 直接img元素属性
  () =>
    container.getAttribute('src') ||
    container.getAttribute('data-src') ||
    container.getAttribute('data-original')

  // 2. Picture元素处理
  // 3. 内部img元素
  // 4. Source元素
  // 5. Data属性
  // 6. 背景图片
]

// URL验证
function isValidImageUrl(url: string): boolean {
  const validDomains = ['i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com']
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']
  // ... 验证逻辑
}
```

## 文件修改

- `src/content/bilibili/utils/bilibili-preview.ts`: 改进了 PhotoSwipe 按钮定位
- `src/content/bilibili/components/bilibili-buttons.ts`: 修复了按钮样式，添加了 `createPhotoSwipeButton` 函数
- `src/content/bilibili/dom/bilibili-injection.ts`: 改进了图片检测和URL解析
- `src/content/bilibili/utils/bilibili-utils.ts`: 增强了URL提取功能
- `src/content/bilibili/bilibili.ts`: 添加了CSS注入和样式修复
- `src/content/bilibili/styles/bilibili-button-fixes.css`: 样式修复CSS文件
- `examples/photoswipe-button-demo.html`: PhotoSwipe 按钮演示页面
- `examples/bilibili-button-fixes-demo.html`: 样式修复演示页面
- `bilibili-control-button-example.html`: 控制面板按钮演示页面
- `bilibili-emoji-button-implementation.md`: 实现文档
