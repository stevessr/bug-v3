# Implementation Plan: 完善现有功能的测试覆盖率

## Phase 1: 基础设施与存储逻辑测试
- [ ] Task: 测试环境配置
    - [ ] 验证 Playwright 扩展测试配置 (`playwright.extension.config.ts`)
    - [ ] 编写通用的扩展加载和初始化 helper
- [ ] Task: 多层存储系统测试
    - [ ] 编写 LocalStorage 与 SessionStorage 的同步读写测试
    - [ ] 编写 Chrome Extension Storage 的持久化测试
    - [ ] 编写 Dexie (IndexedDB) 的大数据量存储测试
- [ ] Task: Conductor - User Manual Verification '基础设施与存储逻辑测试' (Protocol in workflow.md)

## Phase 2: 同步与核心逻辑测试
- [ ] Task: 同步机制测试
    - [ ] 模拟 WebDAV 同步流程（上传、下载、覆盖）
    - [ ] 模拟 S3 兼容存储的同步流程
    - [ ] 编写时间戳冲突解决逻辑的专项测试
- [ ] Task: AI 功能集成测试
    - [ ] 编写模拟 Google Gemini API 的接口并测试自动命名流程
- [ ] Task: Conductor - User Manual Verification '同步与核心逻辑测试' (Protocol in workflow.md)

## Phase 3: UI 交互与回归测试
- [ ] Task: 表情包选择器 UI 测试
    - [ ] 编写表情包搜索与过滤测试
    - [ ] 编写表情包插入（Content Script 交互）测试
- [ ] Task: 管理界面测试
    - [ ] 编写分组创建、排序和拖拽管理测试
    - [ ] 编写设置页面的配置保存与加载测试
- [ ] Task: Conductor - User Manual Verification 'UI 交互与回归测试' (Protocol in workflow.md)
