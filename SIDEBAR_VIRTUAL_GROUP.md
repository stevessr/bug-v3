# Sidebar 虛擬分組功能說明

## 功能概述

在 sidebar 頁面添加了一個名為「所有表情」的虛擬分組，該分組實際上不存在於數據中，僅用於展示所有表情並提供全局搜索功能。

## 主要特性

### 1. 虛擬分組
- **名稱**: 所有表情
- **圖標**: 🔍（搜索圖標）
- **標識**: `isVirtual: true`
- **描述**: 展示所有分組的表情，支持按名稱或標籤搜索

### 2. 全局搜索
- **搜索範圍**: 所有分組中的表情
- **搜索方式**:
  - 按表情名稱搜索（模糊匹配）
  - 按標籤搜索（支持部分匹配）
- **搜索結果**: 顯示匹配的表情，包含：
  - 表情預覽圖
  - 表情名稱
  - 所屬分組
  - 標籤列表（最多顯示2個）
  - 標籤數量提示

### 3. UI 交互
- 在分組選擇器中顯示虛擬分組
- 選中虛擬分組時顯示所有表情
- 支持搜索功能，輸入即搜索
- 虛擬分組不會顯示添加按鈕
- 搜索結果統計和清除功能

## 實現細節

### 虛擬分組定義
```typescript
const virtualGroups = computed(() => [
  {
    id: 'all-emojis',
    name: '所有表情',
    icon: '🔍',
    isVirtual: true
  }
])
```

### 搜索邏輯
```typescript
// 過濾後的表情（支持按名稱和標籤搜索）
const filteredEmojis = computed(() => {
  if (!searchQuery.value.trim()) {
    return []
  }

  const query = searchQuery.value.toLowerCase()
  const allEmojis: Array<any> = []

  // 收集所有表情
  emojiStore.sortedGroups.forEach(group => {
    group.emojis?.forEach(emoji => {
      // 按名稱搜索
      const nameMatch = emoji.name.toLowerCase().includes(query)
      // 按標籤搜索
      const tagMatch = emoji.tags?.some((tag: string) =>
        tag.toLowerCase().includes(query)
      )

      if (nameMatch || tagMatch) {
        allEmojis.push({
          ...emoji,
          groupName: group.name
        })
      }
    })
  })

  return allEmojis
})
```

### 獲取所有表情
```typescript
const getCurrentGroupEmojis = (groupId: string) => {
  if (groupId === 'all-emojis') {
    // 返回所有表情
    const allEmojis = []
    for (const group of emojiStore.sortedGroups) {
      if (group.emojis) {
        allEmojis.push(...group.emojis)
      }
    }
    return allEmojis
  }
  const group = emojiStore.sortedGroups.find(g => g.id === groupId)
  return group ? group.emojis || [] : []
}
```

## 使用方法

1. 打開 sidebar 頁面
2. 在分組選擇器中點擊「所有表情」
3. 查看所有分組的表情
4. 使用搜索框按名稱或標籤搜索表情
5. 點擊清除按鈕（✕）清空搜索

## 技術優勢

- **無需修改數據結構**: 虛擬分組不影響現有數據存儲
- **性能優化**: 使用 computed 屬性實現響應式更新
- **用戶友好**: 提供直觀的全局視圖和搜索功能
- **擴展性強**: 易於添加更多虛擬分組類型
- **實時搜索**: 輸入即搜索，無需點擊按鈕

## 後續優化方向

1. 添加搜索歷史記錄
2. 支持高級搜索過濾（按分組、按標籤數量等）
3. 添加熱門標籤快速篩選
4. 支持搜索結果排序（按使用頻率、按添加時間等）