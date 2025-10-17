# 小红书重复按钮修复

## 问题描述

小红书使用 Swiper 轮播组件，会创建重复的 slide 用于无缝轮播效果。这导致同一张图片出现了多个"添加到未分组表情"按钮。

从 DOM 结构可以看到，同一张图片有 3 个 slide：

```html
<!-- 第1个：复制的 slide -->
<div class="swiper-slide swiper-slide-duplicate ...">
  <img src="...">
  <button class="xhs-emoji-add-btn">添加到未分组表情</button>
</div>

<!-- 第2个：真实显示的 slide -->
<div class="swiper-slide swiper-slide-visible swiper-slide-active ...">
  <img src="...">
  <button class="xhs-emoji-add-btn">添加到未分组表情</button>
</div>

<!-- 第3个：复制的 slide -->
<div class="swiper-slide swiper-slide-duplicate ...">
  <img src="...">
  <button class="xhs-emoji-add-btn">添加到未分组表情</button>
</div>
```

结果：**同一张图片上出现了 3 个按钮！**

## 解决方案

### 1. 过滤重复的 Swiper Slide

在 `addButtonToXhsImage` 函数中添加检测逻辑，跳过带有 `swiper-slide-duplicate` 类的元素：

```typescript
function addButtonToXhsImage(img: HTMLImageElement) {
  try {
    const parent = img.parentElement || (img as Element)
    if (!parent) return
    
    // Skip duplicate swiper slides (Swiper creates duplicate slides for infinite loop)
    let element: Element | null = parent
    while (element && element !== document.body) {
      if (element.classList && element.classList.contains('swiper-slide-duplicate')) {
        console.log('[XHSOneClick] Skipping duplicate swiper slide')
        return
      }
      element = element.parentElement
    }
    
    // ... 继续处理
  }
}
```

**工作原理**:
- 从图片的父元素开始向上遍历 DOM 树
- 检查每个祖先元素是否包含 `swiper-slide-duplicate` 类
- 如果找到，立即返回，不添加按钮
- 只有真实的 slide（不是 duplicate）才会添加按钮

### 2. 精简选择器列表

将选择器从 9 个减少到 2 个，只保留真正有效的：

**修改前**:
```typescript
const selectors = [
  'img.note-slider-img',
  '.img-container img',
  '.swiper-slide img',
  '.note-scroller img',
  '.carousel img',
  '.photo-carousel img',
  'img[class*="note"]',
  'img[class*="slider"]',
  'img[class*="swiper"]'
]
```

**修改后**:
```typescript
const selectors = [
  'img.note-slider-img',
  '.img-container img'
]
```

**原因**:
- `img.note-slider-img` - 直接匹配图片类名
- `.img-container img` - 匹配图片容器中的图片
- 其他选择器要么重复，要么不必要

## 技术细节

### Swiper 无限循环原理

Swiper 为了实现无限循环效果，会：
1. 复制第一张和最后一张 slide
2. 将复制的 slide 添加到两端
3. 当滑到边界时，快速切换到真实的 slide
4. 给用户造成无限循环的错觉

### 重复 Slide 的标识

Swiper 使用特定的类名标识：
- `swiper-slide-duplicate` - 复制的 slide
- `swiper-slide-active` - 当前显示的 slide（真实的）
- `swiper-slide-visible` - 可见的 slide

### 过滤逻辑

我们的过滤逻辑会：
1. ✅ 跳过所有 `swiper-slide-duplicate` 元素
2. ✅ 只在真实的 slide 上添加按钮
3. ✅ 确保每张图片只有一个按钮

## 效果对比

### 修复前
```
图片1: [按钮][按钮][按钮]  ❌ 3个按钮
图片2: [按钮][按钮][按钮]  ❌ 3个按钮
图片3: [按钮][按钮][按钮]  ❌ 3个按钮
```

### 修复后
```
图片1: [按钮]  ✅ 只有1个按钮
图片2: [按钮]  ✅ 只有1个按钮
图片3: [按钮]  ✅ 只有1个按钮
```

## 调试日志

现在当遇到重复 slide 时，会在控制台输出：

```
[XHSOneClick] Skipping duplicate swiper slide
[XHSOneClick] Skipping duplicate swiper slide
[XHSOneClick] scanAndInjectXhs found 3 images
```

这表示：
- 过滤掉了 2 个重复的 slide
- 只在 1 个真实的 slide 上添加了按钮

## 相关文件

- `src/content/xhs/init.ts` - 主要修改文件

## 测试验证

### 测试步骤

1. 访问小红书笔记页面
2. 打开图片轮播
3. 检查图片上的按钮数量

### 预期结果

- ✅ 每张图片只有 1 个按钮
- ✅ 按钮位置正确（右上角）
- ✅ 切换图片时按钮正常显示
- ✅ 控制台显示过滤重复 slide 的日志

### 错误情况

如果仍然出现多个按钮：
1. 检查控制台是否有 `[XHSOneClick] Skipping duplicate swiper slide` 日志
2. 检查 HTML 结构是否有变化
3. 使用浏览器开发者工具检查 slide 的类名

## 性能优化

### 遍历优化

```typescript
while (element && element !== document.body) {
  if (element.classList && element.classList.contains('swiper-slide-duplicate')) {
    return
  }
  element = element.parentElement
}
```

- 最多遍历到 `document.body`
- 找到重复 slide 立即返回
- 平均只需遍历 2-3 层

### 选择器优化

只使用 2 个精确的选择器：
- 减少 DOM 查询次数
- 提高匹配速度
- 降低内存占用

## 版本信息

- **修复日期**: 2025-10-18
- **影响范围**: 小红书图片轮播
- **向后兼容**: ✅ 是
- **破坏性变更**: ❌ 无

## 未来考虑

如果小红书更新了轮播组件：
1. 检查新的重复 slide 标识
2. 更新过滤逻辑
3. 添加更多的类名检测
