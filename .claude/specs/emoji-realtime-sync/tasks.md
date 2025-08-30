# 表情实时同步功能实现计划

本文档将表情实时同步功能设计转换为一系列可执行的编码任务。每个任务都专注于编写、修改或测试代码，确保增量进展和早期测试验证。

## 1. 增强通信服务基础设施

- [x] **1.1 扩展消息类型定义**


  - 在 `src/services/communication.ts` 中添加新的同步消息类型接口
  - 定义 `SyncMessage` 接口，包含 `COMMON_EMOJI_UPDATED`、`EMOJI_ORDER_CHANGED`、`GROUP_ICON_UPDATED`、`UNGROUPED_EMOJIS_CHANGED` 消息类型
  - 为每种消息类型定义对应的 payload 结构
  - 编写单元测试验证消息类型定义的正确性
  - _需求: 1.1, 2.1, 3.1, 4.1_






- [ ] **1.2 实现增强的通信服务方法**
  - 在 `CommunicationService` 类中添加新的发送方法：`sendCommonEmojiUpdated`、`sendEmojiOrderChanged`、`sendGroupIconUpdated`、`sendUngroupedEmojisChanged`
  - 实现对应的监听器方法：`onCommonEmojiUpdated`、`onEmojiOrderChanged`、`onGroupIconUpdated`、`onUngroupedEmojisChanged`
  - 添加消息序列化和反序列化的错误处理
  - 编写单元测试验证新增方法的功能

  - _需求: 1.2, 2.2, 4.2_



## 2. 数据同步管理器实现



- [x] **2.1 创建数据同步管理器核心类**

  - 创建 `src/services/DataSyncManager.ts` 文件
  - 实现 `DataSyncManager` 类的基础结构和构造函数





  - 实现 `watchStorageChanges` 方法监控 Chrome Storage 变化
  - 实现 `syncStorages` 方法同步 localStorage 和 Chrome Storage

  - 编写单元测试验证基础功能
  - _需求: 1.1, 6.1, 6.2_






- [ ] **2.2 实现存储一致性检查器**
  - 创建 `src/services/ConsistencyChecker.ts` 文件
  - 实现 `compareStorages` 方法比较两种存储中的数据差异



  - 实现 `resolveConflicts` 方法解决数据冲突
  - 实现 `validateDataIntegrity` 方法验证数据完整性
  - 编写单元测试验证一致性检查逻辑
  - _需求: 6.1, 6.2_









- [x] **2.3 实现通知队列和批量处理**


  - 在 `DataSyncManager` 中实现 `NotificationQueue` 功能



  - 实现 `processPendingNotifications` 方法批量处理通知
  - 添加防抖和节流机制避免频繁更新


  - 实现优先级队列，确保重要更新优先处理
  - 编写单元测试验证批量处理逻辑
  - _需求: 1.2, 5.1_







## 3. 后台服务增强

- [ ] **3.1 增强表情使用记录处理**
  - 修改 `src/background/handlers/emoji-handlers.ts` 中的 `recordEmojiUsage` 函数


  - 集成 `DataSyncManager` 进行实时数据同步


  - 在表情使用记录成功后立即发送 `COMMON_EMOJI_UPDATED` 消息
  - 确保 localStorage 和 Chrome Storage 同时更新
  - 编写单元测试验证增强的使用记录功能


  - _需求: 1.1, 1.2, 1.4_

- [ ] **3.2 实现未分组表情同步**
  - 修改 `src/data/update/emojiGroupsStore.ts` 中的未分组表情管理方法
  - 在未分组表情变化时发送 `UNGROUPED_EMOJIS_CHANGED` 消息
  - 实现未分组表情的专用存储键 `ungrouped-emojis`
  - 确保未分组表情在所有组件中正确显示
  - 编写单元测试验证未分组表情同步
  - _需求: 3.1, 3.2, 3.3_

- [ ] **3.3 实现分组图标更新同步**
  - 在表情分组管理代码中添加图标更新检测
  - 当分组图标变化时发送 `GROUP_ICON_UPDATED` 消息
  - 实现图标缓存机制避免重复加载
  - 编写单元测试验证图标更新同步
  - _需求: 4.1, 4.2, 4.3_

## 4. 前端表情选择器实时更新

- [ ] **4.1 增强内容脚本表情选择器**
  - 修改 `src/content-script/content/picker/` 中的表情选择器组件
  - 集成增强的通信服务监听器
  - 实现 `onCommonEmojiUpdated` 监听器立即更新常用表情显示
  - 实现 `onEmojiOrderChanged` 监听器立即更新表情排序
  - 编写单元测试验证实时更新功能
  - _需求: 1.1, 1.2, 2.1, 2.2_

- [ ] **4.2 实现未分组表情显示**
  - 在表情选择器中添加未分组表情的显示区域
  - 实现 `onUngroupedEmojisChanged` 监听器更新未分组表情
  - 确保未分组表情与分组表情的显示一致性
  - 编写单元测试验证未分组表情显示
  - _需求: 3.1, 3.2, 3.3_

- [x] **4.3 实现分组图标实时更新**


  - 在表情选择器中实现 `onGroupIconUpdated` 监听器
  - 添加图标缓存和预加载机制
  - 实现图标更新的平滑过渡效果
  - 编写单元测试验证图标实时更新
  - _需求: 4.1, 4.2, 4.3_

## 5. 选项页面实时刷新

- [ ] **5.1 增强选项页面数据监听**
  - 修改 `src/options/` 中的选项页面组件
  - 集成增强的通信服务监听器
  - 实现常用表情统计的实时更新显示
  - 移除手动刷新的依赖，实现自动更新
  - 编写单元测试验证选项页面实时更新
  - _需求: 5.1, 5.2, 5.3_

- [ ] **5.2 实现选项页面UI强制刷新机制**
  - 创建 `RealtimeUIUpdater` 工具类
  - 实现 `forceRefresh` 方法强制刷新UI组件
  - 在数据同步失败时提供手动刷新选项
  - 添加刷新状态指示器
  - 编写单元测试验证UI刷新机制
  - _需求: 5.1, 5.2, 5.3_

## 6. 弹出页面同步增强

- [ ] **6.1 增强弹出页面实时响应**
  - 修改 `src/popup/PopupApp.vue` 中的表情使用处理逻辑
  - 确保表情使用后立即触发所有必要的同步消息
  - 实现弹出页面对其他组件变化的响应
  - 编写单元测试验证弹出页面同步
  - _需求: 1.1, 1.2, 1.4_

## 7. 错误处理和恢复机制

- [ ] **7.1 实现同步错误处理器**
  - 创建 `src/services/SyncErrorHandler.ts` 文件
  - 实现存储写入失败的处理和重试机制
  - 实现通信失败的降级策略
  - 实现数据冲突的自动解决机制
  - 编写单元测试验证错误处理逻辑
  - _需求: 6.1, 6.2, 6.3, 6.4_

- [ ] **7.2 实现降级和重试策略**
  - 在各个组件中集成错误处理器
  - 实现通信失败时的轮询检查降级
  - 实现存储失败时的临时缓存机制
  - 添加用户友好的错误提示
  - 编写单元测试验证降级策略
  - _需求: 6.3, 6.4_

## 8. 性能优化实现

- [ ] **8.1 实现批量更新管理器**
  - 创建 `src/services/BatchUpdateManager.ts` 文件
  - 实现更新操作队列和批量处理逻辑
  - 实现防抖和节流机制
  - 实现高优先级更新的立即处理
  - 编写单元测试验证批量更新性能
  - _需求: 1.2, 5.2_

- [ ] **8.2 实现缓存策略**
  - 在各个组件中添加内存缓存机制
  - 实现时间戳缓存避免重复检查
  - 实现增量更新只同步变化数据
  - 编写单元测试验证缓存效果
  - _需求: 1.4, 2.2, 4.2_

## 9. 集成测试和验证

- [ ] **9.1 实现跨组件同步集成测试**
  - 创建端到端测试验证完整的表情使用到同步流程
  - 测试从内容脚本使用表情到所有界面更新的完整链路
  - 验证数据在 localStorage 和 Chrome Storage 中的一致性
  - 测试浏览器重启后的数据恢复
  - _需求: 1.1, 1.2, 1.4, 6.3_

- [ ] **9.2 实现并发操作和异常场景测试**
  - 测试多个组件同时操作表情时的数据一致性
  - 测试网络异常和存储异常时的系统行为
  - 验证错误恢复和重试机制的有效性
  - 测试性能优化措施的实际效果
  - _需求: 6.1, 6.2, 6.4_