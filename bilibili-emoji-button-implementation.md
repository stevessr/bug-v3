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
      <path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zM5.5 4.5c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm3 0c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zM7 11c-1.657 0-3-1.343-3-3h6c0 1.657-1.343 3-3 3z"/>
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

## 文件修改

- `src/content/bilibili.ts`: 添加了新的控制按钮功能
- `bilibili-control-button-example.html`: 演示页面
- `bilibili-emoji-button-implementation.md`: 实现文档
