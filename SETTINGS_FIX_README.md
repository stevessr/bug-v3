# 设置页面保存逻辑修复

## 问题描述
设置页面的保存逻辑存在问题，用户修改设置后刷新页面会重置为默认值，导致设置无法有效保存。

## 问题分析

### 原因分析
1. **存储冲突解决机制问题**：原来的`getWithConflictResolution`方法总是选择时间戳最新的数据，但在某些情况下可能导致选择错误的数据源。
2. **异步保存不完整**：设置更新使用渐进式保存，但没有确保所有存储层都成功保存。
3. **错误处理不足**：设置保存失败时没有适当的错误处理和回滚机制。
4. **页面初始化问题**：页面加载时可能从过期的存储层读取设置。

### 技术细节
- 使用了多层存储：localStorage → sessionStorage → chrome.storage.local
- 设置被包装成 `{ data: value, timestamp: timestamp }` 格式
- 冲突解决依赖时间戳，但可能存在时间戳不准确的情况

## 修复方案

### 1. 改进存储冲突解决机制
```typescript
// 对于设置，优先使用扩展存储确保持久性
async getWithConflictResolution(key: string): Promise<any> {
  if (key === STORAGE_KEYS.SETTINGS) {
    try {
      const extensionValue = await this.extensionStorage.get(key)
      if (extensionValue && extensionValue.data) {
        return extensionValue.data
      }
    } catch (error) {
      console.warn('[Storage] Failed to get settings from extension storage:', error)
    }
  }
  // 其他键使用原有的时间戳冲突解决逻辑
}
```

### 2. 改进设置保存逻辑
```typescript
async setSettings(settings: AppSettings): Promise<void> {
  try {
    const stored = await storageManager.getWithConflictResolution(STORAGE_KEYS.SETTINGS)
    const mergedSettings = { ...(stored || {}), ...settings }
    const updatedSettings = { ...defaultSettings, ...mergedSettings, lastModified: Date.now() }
    
    // 立即保存到所有存储层确保持久性
    await Promise.allSettled([
      storageManager.localStorage.set(STORAGE_KEYS.SETTINGS, updatedSettings),
      storageManager.sessionStorage.set(STORAGE_KEYS.SETTINGS, updatedSettings),
      storageManager.extensionStorage.set(STORAGE_KEYS.SETTINGS, updatedSettings)
    ])
  } catch (error) {
    console.error('[Storage] Failed to save settings:', error)
    throw error
  }
}
```

### 3. 将所有更新方法改为异步
```typescript
// 原来
const updateTheme = (theme: string) => {
  emojiStore.updateSettings({ theme })
}

// 修复后
const updateTheme = async (theme: string) => {
  await emojiStore.updateSettings({ theme })
  // 其他逻辑...
}
```

### 4. 改进错误处理
```typescript
const updateSettings = async (newSettings: Partial<AppSettings>) => {
  try {
    const oldSettings = { ...settings.value }
    settings.value = { ...settings.value, ...newSettings }
    
    await newStorageHelpers.setSettings(settings.value)
    await syncSettingsToBackground()
  } catch (error) {
    console.error('[EmojiStore] updateSettings failed:', error)
    // 失败时回滚本地状态
    settings.value = oldSettings
    throw error
  }
}
```

### 5. 改进主题初始化
```typescript
const initializeTheme = () => {
  const settingsTheme = emojiStore.settings.theme
  const localTheme = localStorage.getItem('theme') || localStorage.getItem('appSettings_theme')
  const finalTheme = settingsTheme || localTheme || 'system'
  
  updateTheme(finalTheme)
}
```

### 6. 添加存储变化监听
```typescript
const setupStorageChangeListener = () => {
  try {
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.onChanged) {
      chromeAPI.storage.onChanged.addListener((changes: any, namespace: string) => {
        if (namespace === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
          const newSettings = changes[STORAGE_KEYS.SETTINGS].newValue
          if (newSettings && newSettings.data) {
            settings.value = { ...defaultSettings, ...newSettings.data }
          }
        }
      })
    }
  } catch (error) {
    console.warn('[EmojiStore] Failed to setup storage change listener:', error)
  }
}
```

## 修复的文件

### 1. `/src/utils/newStorage.ts`
- 改进 `getWithConflictResolution` 方法，对设置优先使用扩展存储
- 改进 `setSettings` 方法，立即保存到所有存储层
- 添加详细的日志记录

### 2. `/src/stores/emojiStore.ts`
- 将 `updateSettings` 方法改为异步
- 添加错误处理和状态回滚
- 添加存储变化监听器
- 改进数据加载时的设置保存逻辑

### 3. `/src/options/useOptions.ts`
- 将所有 `updateXXX` 方法改为异步
- 改进主题初始化逻辑
- 添加额外的localStorage保存（兼容性）

### 4. `/src/options/components/GlobalSettings.vue`
- 将所有事件处理器改为异步
- 添加错误处理
- 改进用户交互反馈

## 测试验证

创建了测试页面 `/test-settings.html`，包含以下测试：
- 基本设置保存和读取
- 主题设置保存和读取
- 复杂设置保存和读取
- 多次快速更新测试
- 页面刷新持久性测试

## 使用方法

1. 重新构建项目：`npm run build`
2. 在浏览器中加载扩展
3. 访问设置页面：`http://localhost:5173/index.html?type=options&tabs=settings`
4. 修改任意设置
5. 刷新页面验证设置是否保存

## 预期效果

- ✅ 设置修改后立即保存
- ✅ 页面刷新后设置保持不变
- ✅ 多个标签页之间设置同步
- ✅ 错误时适当回滚和提示
- ✅ 主题切换立即生效并持久化

## 注意事项

1. 修改涉及存储核心逻辑，建议先在开发环境测试
2. 确保浏览器扩展有足够的存储权限
3. 如果使用隐身模式，某些存储可能受限
4. 建议清除浏览器存储后重新测试

## 兼容性

- 保持与原有数据格式兼容
- 支持渐进式迁移
- 向后兼容旧版本设置