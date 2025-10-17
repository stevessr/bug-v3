# 常用表情一键清除功能

## 功能概述

为常用表情添加了一键清除功能，允许用户快速清空所有常用表情记录。

## 修改内容

### 1. EmojiStore 添加清除方法

**文件**: `src/stores/emojiStore.ts`

添加了 `clearAllFavorites()` 方法：

```typescript
const clearAllFavorites = () => {
  const favoritesGroup = groups.value.find(g => g.id === 'favorites')
  if (!favoritesGroup) {
    console.warn('[EmojiStore] Favorites group not found')
    return
  }
  
  // Clear all emojis from favorites group
  favoritesGroup.emojis = []
  console.log('[EmojiStore] clearAllFavorites - cleared all favorite emojis')
  maybeSave()
}
```

### 2. 选项页面添加清除按钮

**文件**: `src/options/components/FavoritesTab.vue`

- 添加了"清空常用"按钮
- 使用 Ant Design Vue 的 `a-popconfirm` 组件确认操作
- 按钮仅在有常用表情时显示
- 操作成功后显示提示消息

```vue
<a-popconfirm
  v-if="favoritesGroup && favoritesGroup.emojis?.length"
  title="确认清空所有常用表情吗？此操作不可撤销。"
  ok-text="确认"
  cancel-text="取消"
  @confirm="handleClearAllFavorites"
>
  <template #icon>
    <QuestionCircleOutlined style="color: red" />
  </template>
  <a-button danger size="small">
    <template #icon>
      <DeleteOutlined />
    </template>
    清空常用
  </a-button>
</a-popconfirm>
```

### 3. 用户脚本版本

**文件**: `src/userscript/modules/popularEmojis.ts`

用户脚本版本已经有清空统计功能：
- 在常用表情弹窗中显示"清空统计"按钮
- 使用 `clearEmojiUsageStats()` 清除所有使用记录
- 清空后显示成功消息并刷新弹窗

## 功能特性

### 扩展版本（Extension）

1. **位置**: 选项页面 → 常用表情标签页
2. **按钮样式**: 红色危险按钮，带删除图标
3. **确认对话框**: 
   - 标题："确认清空所有常用表情吗？此操作不可撤销。"
   - 红色警告图标
4. **反馈**: 操作成功后显示"已清空所有常用表情"消息
5. **显示条件**: 仅在有常用表情时显示按钮

### 用户脚本版本（Userscript）

1. **位置**: 常用表情弹窗右上角
2. **按钮样式**: 红色背景按钮，显示"清空统计"
3. **确认对话框**: 浏览器原生 `confirm` 对话框
4. **反馈**: 清空后显示临时消息并重新打开弹窗
5. **统计说明**: 弹窗底部显示"统计数据保存在本地，清空统计将重置所有使用记录"

## 用户体验

1. **安全性**: 
   - 所有清空操作都需要确认
   - 明确提示"此操作不可撤销"
   
2. **可见性**: 
   - 按钮使用红色危险样式，表明是破坏性操作
   - 仅在有数据时显示，避免误操作
   
3. **反馈**: 
   - 操作成功后立即显示确认消息
   - 数据立即更新，无需刷新页面

## 技术实现

- 使用 Pinia store 管理状态
- 自动保存到存储（通过 `maybeSave()`）
- 支持扩展和用户脚本两种环境
- 清空操作记录日志，便于调试

## 测试验证

✅ 构建成功，无编译错误
✅ TypeScript 类型检查通过
✅ 功能已集成到现有代码架构

## 相关文件

- `src/stores/emojiStore.ts` - Store 方法
- `src/options/components/FavoritesTab.vue` - UI 组件
- `src/userscript/modules/popularEmojis.ts` - 用户脚本弹窗
- `src/userscript/userscript-storage.ts` - 用户脚本存储
