# Track Specification: 完善现有功能的测试覆盖率

## 概述
本 Track 的目标是提高 Emoji Extension 核心功能的测试覆盖率，特别是针对多层存储系统、同步逻辑和核心 UI 交互。通过编写 Playwright 端到端测试，确保在进行后续功能开发或重构时，现有功能能够保持稳定。

## 目标
- 核心存储逻辑（LocalStorage, SessionStorage, Extension Storage, IndexedDB）的读写和回退逻辑测试。
- 同步功能（WebDAV, S3, Chrome Sync）的模拟测试。
- 表情包选择器、分组管理和 AI 命名功能的 UI 自动化测试。
- 确保测试覆盖率达到 80% 以上（针对核心模块）。

## 范围
- **存储系统:** `src/shared/storage/` 下的逻辑。
- **状态管理:** `src/shared/stores/` 下的 Pinia store 状态流转。
- **UI 交互:** Popup 页面和 Options 页面的主要功能流程。

## 技术方案
- 使用 **Playwright** 作为主测试框架。
- 利用 Playwright 的浏览器扩展测试支持。
- 使用 Mock 服务模拟 WebDAV 和 S3 同步服务器。
- 使用 `test-results` 目录存储测试报告。

## 验收标准
- [ ] 存储系统的所有读写路径均有对应的测试用例。
- [ ] 同步功能的冲突解决逻辑经过测试验证。
- [ ] UI 关键路径（添加、分组、搜索）无故障运行。
- [ ] 所有测试在本地环境通过。
