# X (Twitter) 图片注入功能开关

## 概述

为 X (Twitter) 平台的图片注入功能添加了细粒度控制开关，允许通过配置文件分别控制不同场景下的图片注入功能。

## 修改内容

### 1. 配置文件 `xConfig.ts`

**文件路径**: `src/content/x/xConfig.ts`

提供了细粒度的配置选项，可以分别控制不同场景的图片注入功能。

```typescript
export const xConfig = {
  imageInjection: {
    // 轮播图图片
    enableCarousel: true,
    
    // 推文中的图片
    enableTweetImages: true,
    
    // 对话框/模态框中的图片
    enableDialogImages: true,
    
    // 列表项图片
    enableListItemImages: true,
    
    // 滑动关闭元素中的图片
    enableSwipeToDismissImages: true,
    
    // 独立媒体页面图片
    enableStandaloneMediaImages: true,
  },
} as const
```

### 2. 图片类型枚举

新增了 `ImageType` 枚举来标识不同的图片场景：

```typescript
export enum ImageType {
  Carousel = 'carousel',              // 轮播图
  Tweet = 'tweet',                    // 推文图片
  Dialog = 'dialog',                  // 对话框/模态框
  ListItem = 'listItem',              // 列表项
  SwipeToDismiss = 'swipeToDismiss',  // 滑动关闭元素
  StandaloneMedia = 'standaloneMedia', // 独立媒体页面
}
```

### 3. 增强的检查函数

`isImageInjectionEnabled()` 函数现在支持类型参数：

```typescript
// 检查是否至少有一个类型启用
isImageInjectionEnabled()

// 检查特定类型是否启用
isImageInjectionEnabled(ImageType.Carousel)
isImageInjectionEnabled(ImageType.Tweet)
isImageInjectionEnabled(ImageType.Dialog)
```

### 4. 修改 `carousel.ts`

**文件路径**: `src/content/x/image/carousel.ts`

#### 4.1 新增 `detectImageType()` 函数

自动检测元素所属的图片类型：

```typescript
function detectImageType(el: Element): ImageType | null {
  // 检查轮播图
  if (el.closest('[role="group"][aria-roledescription="carousel"]')) {
    return ImageType.Carousel
  }
  
  // 检查对话框/模态框
  if (el.closest('[role="dialog"]') || el.closest('[aria-modal="true"]')) {
    return ImageType.Dialog
  }
  
  // 检查推文
  if (el.closest('article[data-testid="tweet"]') && ...) {
    return ImageType.Tweet
  }
  
  // ... 其他类型检测
  
  return null
}
```

#### 4.2 更新 `addCarouselButtonToEl()` 函数

在注入前检测图片类型并验证该类型是否启用：

```typescript
function addCarouselButtonToEl(el: Element) {
  try {
    // 检测图片类型
    const imageType = detectImageType(el)
    if (!imageType) return
    
    // 检查该类型的图片注入是否启用
    if (!isImageInjectionEnabled(imageType)) {
      return
    }
    
    // ... 继续注入逻辑
```

#### 4.3 更新 `scanAndInjectCarousel()` 函数

根据配置动态构建选择器，只扫描启用的类型：

```typescript
export function scanAndInjectCarousel() {
  if (!isImageInjectionEnabled()) {
    return
  }
  
  const selectors: string[] = []
  
  // 根据配置动态添加选择器
  if (isImageInjectionEnabled(ImageType.Carousel)) {
    selectors.push(
      '[role="group"][aria-roledescription="carousel"] div[aria-label="Image"]',
      // ...
    )
  }
  
  if (isImageInjectionEnabled(ImageType.Tweet)) {
    selectors.push(
      'article[data-testid="tweet"] div[aria-label="Image"]',
      // ...
    )
  }
  
  // ... 其他类型
```

### 5. 修改 `xImages.ts`

**文件路径**: `src/content/x/xImages.ts`

在初始化时检查是否至少有一个类型启用：

```typescript
export function initXImages() {
  try {
    // 检查是否至少有一个类型启用
    if (!isImageInjectionEnabled()) {
      console.log('[XImages] All image injection types disabled')
      return
    }
    
    scanAndInjectCarousel()
    observeCarousel()
  } catch (err) {
    console.error('[XImages] init failed', err)
  }
}
```

## 配置详解

### 轮播图 (Carousel)

```typescript
enableCarousel: true
```

控制范围：
- `[role="group"][aria-roledescription="carousel"]` 中的图片
- 典型场景：推文中的多图轮播

### 推文图片 (Tweet Images)

```typescript
enableTweetImages: true
```

控制范围：
- `article[data-testid="tweet"]` 中的图片
- `div[data-testid="tweetPhoto"]` 元素
- 典型场景：时间线上的推文图片、个人页面的推文图片

### 对话框图片 (Dialog Images)

```typescript
enableDialogImages: true
```

控制范围：
- `[role="dialog"]` 中的图片
- `[aria-modal="true"]` 中的图片
- 典型场景：点击图片后的全屏查看对话框

### 列表项图片 (List Item Images)

```typescript
enableListItemImages: true
```

控制范围：
- `li[role="listitem"]` 中的图片
- 典型场景：某些列表视图中的图片

### 滑动关闭图片 (Swipe to Dismiss)

```typescript
enableSwipeToDismissImages: true
```

控制范围：
- `[data-testid="swipe-to-dismiss"]` 中的图片
- 典型场景：可滑动关闭的图片查看器

### 独立媒体页面 (Standalone Media)

```typescript
enableStandaloneMediaImages: true
```

控制范围：
- 直接访问 `pbs.twimg.com` 图片链接时
- 典型场景：在新标签页中打开 Twitter 图片链接

## 使用示例

### 示例 1：只启用推文图片注入

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,
    enableTweetImages: true,      // ✓ 只启用这个
    enableDialogImages: false,
    enableListItemImages: false,
    enableSwipeToDismissImages: false,
    enableStandaloneMediaImages: false,
  },
} as const
```

### 示例 2：启用推文和对话框，禁用轮播图

```typescript
export const xConfig = {
  imageInjection: {
    enableCarousel: false,        // ✗ 禁用轮播图
    enableTweetImages: true,      // ✓ 启用推文
    enableDialogImages: true,     // ✓ 启用对话框
    enableListItemImages: true,
    enableSwipeToDismissImages: true,
    enableStandaloneMediaImages: true,
  },
} as const
```

### 示例 3：全部禁用

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

### 示例 4：全部启用（默认配置）

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

## 性能优化

通过细粒度控制，可以提升性能：

1. **减少 DOM 查询**：禁用的类型不会执行对应的选择器查询
2. **减少注入操作**：只处理启用类型的元素
3. **减少观察器负担**：MutationObserver 只对启用的类型做出响应

例如，如果只需要推文图片注入功能，禁用其他类型可以显著减少 DOM 操作。

## 调试建议

1. 修改配置后需要重新构建项目
2. 可以在浏览器控制台查看日志：
   ```
   [XImages] All image injection types disabled  // 所有类型都禁用
   [XCarousel] Image injection disabled by config // 观察器被禁用
   ```
3. 使用浏览器开发工具检查元素上是否有 `.injected` 类名
4. 检查是否有 `.x-emoji-add-btn-carousel` 按钮元素

## 注意事项

1. **配置是编译时确定的**：所有配置都是 `const`，在运行时不可修改
2. **修改后需重新构建**：修改配置文件后必须重新构建项目才能生效
3. **类型检测顺序**：元素可能同时匹配多个类型，按优先级返回第一个匹配的类型
4. **向后兼容**：`isImageInjectionEnabled()` 无参数调用会检查是否至少有一个类型启用

## 相关文件

- `src/content/x/xConfig.ts` - 配置文件
- `src/content/x/xImages.ts` - 图片初始化入口
- `src/content/x/image/carousel.ts` - 轮播图注入核心逻辑
- `src/content/x/xMedia.ts` - 媒体功能入口
- `src/content/x/xMain.ts` - X 平台主入口
