# Background Script Fix Verification Guide

## 问题描述
原始问题：Content script 无法从 background script 获取表情数据，导致控制台报错：
```
[Mr Emoji] Background did not return emoji data, falling back to defaults
[Mr Emoji] Final cache state (from background): {groupsCount: 1, emojisCount: 0, ungroupedCount: 0}
```

## 修复内容

### 1. 修复的文件
- `src/background/index.ts` - 主要的 background script 文件 (被 vite 构建使用)
- `src/background.ts` - 备用的 background script 文件

### 2. 关键修复点

#### A. 移除 JSON 文件依赖
**修复前**：Background script 会尝试从 `converted_payload.json` 加载默认数据
**修复后**：完全依赖扩展存储 (chrome.storage.local)

#### B. 改进数据加载函数
```javascript
// 新增：直接从 chrome.storage.local 加载数据
async function loadFromChromeStorage(): Promise<any> {
  // 读取 Settings, ungrouped, emojiGroups-index 和所有 emojiGroups-* 键
  // 按照 index 顺序组装表情组数据
}
```

#### C. 增强 GET_EMOJI_DATA 处理器
```javascript
// 修复前：只从缓存获取数据
if (lastPayloadGlobal) {
  // 返回缓存数据
}

// 修复后：缓存为空时刷新加载
if (groups.length === 0) {
  const freshData = await loadFromChromeStorage()
  // 更新缓存并返回最新数据
}
```

### 3. 数据流程
```
Options 页面保存表情
    ↓
chrome.storage.local 存储
    ↓  
payload-updated 消息
    ↓
Background script 更新缓存
    ↓
Content script 发送 GET_EMOJI_DATA
    ↓
Background script 响应数据
```

## 验证方法

### 1. 运行自动化测试
```bash
cd /home/runner/work/bug-v3/bug-v3
node test/verify-background-storage.js
```

预期输出：
```
🎉 All tests passed! Background script correctly loads emoji data from extension storage.
📋 Verified behaviors:
   ✓ Loads complete emoji data with multiple groups
   ✓ Handles empty storage gracefully  
   ✓ Loads settings independently of emoji groups
   ✓ Uses emojiGroups-index to preserve group order
   ✓ Returns standardized response format for content scripts
```

### 2. 构建验证
```bash
pnpm run build
```

确保构建成功且 `dist/background.js` 包含修复后的逻辑。

### 3. 手动测试步骤 (需要浏览器环境)

1. **安装扩展**：
   - 将 `dist/` 目录作为解压扩展安装到 Chrome
   - 确保 manifest 正确配置 background script

2. **导入表情数据**：
   - 打开 options 页面
   - 导入或添加表情组
   - 确认数据保存到扩展存储

3. **测试 Content Script**：
   - 打开支持的论坛页面 (如 linux.do)
   - 查看控制台，应该显示：
     ```
     [Mr Emoji] Successfully loaded 17 groups with 812 total emojis
     ```
   - 不应再出现 "Background did not return emoji data" 错误

4. **测试实时同步**：
   - 在 options 页面添加新表情组
   - 刷新论坛页面，新表情应该立即可用

## 技术细节

### Chrome Storage 结构
```javascript
{
  "Settings": { imageScale: 30, gridColumns: 4, ... },
  "ungrouped": [...],
  "emojiGroups-index": ["uuid1", "uuid2", "uuid3"],
  "emojiGroups-uuid1": { UUID: "uuid1", displayName: "组1", emojis: [...] },
  "emojiGroups-uuid2": { UUID: "uuid2", displayName: "组2", emojis: [...] },
  ...
}
```

### 消息格式
**GET_EMOJI_DATA 请求**：
```javascript
{ type: 'GET_EMOJI_DATA' }
```

**响应**：
```javascript
{
  success: true,
  data: {
    groups: [...],
    settings: {...},
    ungroupedEmojis: [...]
  }
}
```

## 兼容性
- ✅ Chrome 扩展
- ✅ Firefox 扩展 (使用 browser API)
- ✅ Manifest V3
- ✅ 异步消息处理

## 总结
修复确保了 background script 完全依赖扩展存储而不是静态 JSON 文件，实现了：
- 实时数据同步
- 正确的消息通信
- 错误处理
- 多浏览器兼容性