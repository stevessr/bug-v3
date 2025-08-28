# 表情选择器使用计数更新功能实现总结

## 问题描述

用户需求：前端注入的表情选择器在使用表情后要立刻更新对应表情在常用表情分组中的使用计数。

## 技术实现

### 1. 主要修改文件

#### `src/content-script/content/picker.ts`

- **导入通信服务**: 添加了 `createContentScriptCommService` 导入
- **创建使用记录函数**: 实现了 `recordEmojiUsage` 异步函数
- **保留UUID信息**: 在表情HTML生成时添加 `data-uuid` 属性
- **点击事件处理**: 修改表情点击事件，使用原始UUID并调用使用记录功能

#### `src/background/index.ts`

- **添加消息处理器**: 支持 `RECORD_EMOJI_USAGE` 消息类型
- **Chrome和Firefox支持**: 为两种浏览器API都添加了处理逻辑
- **数据更新机制**: 实现了表情使用计数的更新和存储

### 2. 功能流程

1. **表情选择器创建**

   ```typescript
   // 在生成表情HTML时保留UUID
   const emojiUUID = emojiData.UUID || ''
   groupEmojisHtml += `<img ... data-uuid="${emojiUUID}" ... />`
   ```

2. **表情点击处理**

   ```typescript
   img.addEventListener('click', async () => {
     const originalUUID = img.getAttribute('data-uuid') || ''

     // 先记录使用统计
     if (originalUUID) {
       await recordEmojiUsage(originalUUID)
     }

     // 再插入表情
     await insertEmoji(emojiData)
   })
   ```

3. **使用统计记录**

   ```typescript
   async function recordEmojiUsage(uuid: string): Promise<boolean> {
     // 通过后台通信更新使用计数
     const response = await sendMessageToBackground({
       type: 'RECORD_EMOJI_USAGE',
       uuid: uuid,
     })

     // 如果成功，通知其他页面
     if (response.success) {
       commService.sendUsageRecorded(uuid)
       return true
     }

     // 失败时的回退机制
     const { recordUsage } = await import('../../data/store/main')
     return recordUsage(uuid)
   }
   ```

4. **后台处理逻辑**
   ```typescript
   // 支持 RECORD_EMOJI_USAGE 消息
   if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
     // 使用 emojiGroupsStore.recordUsageByUUID() 更新计数
     // 或直接操作存储数据
     // 按天衰减算法：每天衰减80%
   }
   ```

### 3. 关键特性

#### 实时通信

- 使用 `createContentScriptCommService()` 进行页面间通信
- 通过 `sendUsageRecorded(uuid)` 通知其他页面使用记录更新
- 支持实时UI更新，确保常用表情列表立即反映使用变化

#### 错误处理和回退

- 主要方式：通过后台服务 `RECORD_EMOJI_USAGE` 消息
- 回退方式：直接调用 `recordUsage()` 函数
- 确保即使通信失败也不影响表情插入功能

#### 使用计数算法

- 新表情：`usageCount = 1`，`lastUsed = now`
- 已用表情：按天衰减80%，然后 `usageCount += 1`
- 衰减公式：`usageCount * Math.pow(0.8, days)`

#### 跨浏览器支持

- Chrome: 使用 `chrome.runtime.sendMessage`
- Firefox: 使用 `browser.runtime.sendMessage`
- 两套完整的消息处理逻辑

### 4. 测试验证

#### E2E测试文件：`e2e/emoji-usage-recording.spec.ts`

- **基本功能**: 点击表情记录使用统计
- **多表情使用**: 验证多个表情分别记录
- **失败回退**: 验证后台通信失败时的回退机制

#### 测试场景

1. 表情点击 → 使用计数更新 → 通知其他页面
2. 多个表情连续使用 → 分别记录统计
3. 后台通信失败 → 回退到直接调用 → 仍能记录使用

### 5. 用户体验改进

#### 即时反映

- 表情使用后立即更新常用表情列表
- 通过通信服务实时同步到所有打开的页面
- 无需刷新页面或重新打开扩展

#### 数据持久化

- 使用计数保存到 Chrome/Firefox 扩展存储
- 支持跨会话数据保持
- 按天衰减算法保持数据新鲜度

#### 性能优化

- 异步处理，不阻塞表情插入
- 批量存储更新
- 缓存机制减少存储访问

## 架构优势

### 1. 模块化设计

- 清晰的功能分离：表情选择器、使用记录、后台通信
- 易于维护和扩展

### 2. 容错性强

- 多层回退机制
- 错误不影响核心功能

### 3. 实时同步

- 页面间实时通信
- 立即反映使用变化

### 4. 扩展性好

- 支持新的表情源
- 支持不同的计数算法
- 支持多种通信方式

## 总结

这次实现成功为表情选择器添加了完整的使用计数更新功能，包括：

- ✅ 实时记录表情使用统计
- ✅ 按天衰减的计数算法
- ✅ 跨页面实时通信同步
- ✅ 错误处理和回退机制
- ✅ 跨浏览器兼容性
- ✅ 全面的测试覆盖

用户现在可以在使用表情后立即看到常用表情列表的更新，提供了更好的用户体验和智能的表情推荐。
