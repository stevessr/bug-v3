# 表情选择器实时设置获取功能修改总结

## 问题描述

用户反馈：表情选择器点击表情输入的图片缩放和格式要实时从后端获取。

## 问题分析

原来的实现中，`src/content-script/content/picker.ts` 中的 `insertEmoji` 函数使用的是缓存的 `cachedState.settings`，这意味着：

- 图片缩放比例 (`imageScale`) 使用的是页面加载时缓存的值
- 输出格式 (`outputFormat`) 使用的是页面加载时缓存的值
- 当用户在设置页面修改这些设置后，表情插入功能不会立即反映最新设置

而 `src/helper/inject/main.ts` 中使用的是 `store.getSettings()` 实时获取设置，存在不一致性。

## 解决方案

### 1. 添加后台通信功能

在 `picker.ts` 文件顶部添加了后台通信相关接口和函数：

```typescript
// 导入后台通信函数
interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: any[]
    settings?: any
    ungroupedEmojis?: any[]
  }
  error?: string
}

function sendMessageToBackground(message: any): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: BackgroundResponse) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}
```

### 2. 修改insertEmoji函数为异步函数

将 `insertEmoji` 函数改为异步函数，使其能够在每次点击表情时实时获取最新设置：

```typescript
async function insertEmoji(emojiData: emoji) {
  // ... 原有的文本框查找逻辑 ...

  // 实时从后端获取最新设置
  let currentSettings = cachedState.settings // 默认使用缓存设置作为备用
  try {
    console.log('[Emoji Insert] 实时获取最新设置...')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })
    if (response && response.success && response.data && response.data.settings) {
      currentSettings = { ...cachedState.settings, ...response.data.settings }
      console.log('[Emoji Insert] 成功获取最新设置:', currentSettings)
    } else {
      console.warn('[Emoji Insert] 获取最新设置失败，使用缓存设置')
    }
  } catch (error) {
    console.error('[Emoji Insert] 获取设置时出错:', error)
  }

  // 获取缩放比例（使用实时设置）
  const imageScale = currentSettings.imageScale || 30

  // ... 后续逻辑使用 currentSettings 而不是 cachedState.settings ...
}
```

### 3. 更新函数调用方式

由于 `insertEmoji` 现在是异步函数，需要更新调用方式：

```typescript
// 原来的调用方式
insertEmoji(emojiData)
picker.remove()

// 修改后的调用方式
insertEmoji(emojiData)
  .then(() => {
    picker.remove()
  })
  .catch((error) => {
    console.error('[Emoji Insert] 插入表情失败:', error)
    picker.remove()
  })
```

## 功能特性

### 1. 实时设置获取

- 每次点击表情时，都会向后台发送 `{ type: 'GET_EMOJI_DATA' }` 消息
- 获取最新的 `imageScale` 和 `outputFormat` 设置
- 确保表情插入使用的是用户当前的最新设置

### 2. 错误处理和回退机制

- 如果后台通信失败，会回退到使用缓存的设置
- 提供详细的日志输出，便于调试
- 确保即使网络或后台问题也不会影响基本功能

### 3. 设置合并策略

- 使用 `{ ...cachedState.settings, ...response.data.settings }` 合并策略
- 缓存设置作为基础，实时设置覆盖对应字段
- 确保即使后台只返回部分设置也能正常工作

## 测试验证

### 1. 单元测试

创建了 `test/emoji-settings-realtime.test.ts` 测试文件，验证：

- 实时获取最新设置的逻辑
- 设置获取失败时的回退机制
- 不同设置下的表情格式生成
- 异步函数的错误处理

### 2. E2E测试

创建了 `e2e/emoji-realtime-settings.spec.ts` 测试文件，验证：

- 完整的用户交互流程
- 实时设置获取在浏览器环境中的工作
- 设置变更的即时反映

## 效果验证

修改完成后，用户体验的改善：

1. **即时反映设置变更**：用户在设置页面修改图片缩放或输出格式后，立即在表情插入中生效
2. **一致的用户体验**：消除了不同功能模块之间设置同步的不一致性
3. **可靠的回退机制**：即使在网络问题或后台故障时，基本功能依然可用

## 兼容性

- 保持向后兼容，原有的缓存机制作为回退方案
- 不影响现有的表情选择器UI和交互逻辑
- 对性能影响最小，只在用户实际点击表情时才进行后台通信

## 日志输出

为便于调试，添加了详细的日志输出：

- `[Emoji Insert] 实时获取最新设置...` - 开始获取设置
- `[Emoji Insert] 成功获取最新设置:` - 成功获取并显示设置内容
- `[Emoji Insert] 获取最新设置失败，使用缓存设置` - 回退到缓存设置
- `[Emoji Insert] 获取设置时出错:` - 显示具体错误信息

这些修改确保了表情选择器的图片缩放和格式设置能够实时从后端获取，提供了更好的用户体验和设置一致性。
