# 虛擬分組功能說明

## 功能概述

在 sidebar（popup）頁面添加了一個名為「所有表情」的虛擬分組，該分組實際上不存在於數據中，僅用於展示所有表情並提供全局搜索功能。

## 主要特性

### 1. 虛擬分組
- **名稱**: 所有表情
- **圖標**: 🔍（搜索圖標）
- **描述**: 查看所有表情並進行搜索
- **標識**: `isVirtual: true`

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
- 點擊「所有表情」分組進入搜索模式
- 實時搜索，輸入即搜索
- 顯示搜索結果統計
- 支持清空搜索
- 搜索結果為空時顯示友好提示

## 實現細節

### 虛擬分組定義
```typescript
const virtualGroups = computed(() => [
  {
    id: 'all-emojis',
    name: '所有表情',
    icon: '🔍',
    isVirtual: true,
    description: '查看所有表情並進行搜索'
  }
])
```

### 搜索邏輯
```typescript
// 收集所有表情
emojiStore.groups.forEach(group => {
  group.emojis.forEach(emoji => {
    const nameMatch = emoji.name.toLowerCase().includes(query)
    const tagMatch = emoji.tags?.some(tag =>
      tag.toLowerCase().includes(query)
    )

    if (nameMatch || tagMatch) {
      allEmojis.push({ emoji, group: group.name })
    }
  })
})
```

## 使用方法

1. 打開表情選擇器（sidebar）
2. 點擊左側的「所有表情」分組
3. 在搜索框中輸入關鍵詞
4. 查看搜索結果並點擊使用表情

## 技術優勢

- **無需修改數據結構**: 虛擬分組不影響現有數據存儲
- **性能優化**: 使用 computed 屬性實現響應式搜索
- **用戶友好**: 提供直觀的搜索界面和即時反饋
- **擴展性強**: 易於添加更多虛擬分組類型

## 後續優化方向

1. 添加搜索歷史記錄
2. 支持高級搜索過濾（按分組、按標籤數量等）
3. 添加熱門標籤快速篩選
4. 支持搜索結果排序（按使用頻率、按添加時間等）