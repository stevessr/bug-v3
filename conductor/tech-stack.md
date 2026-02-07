# 技术栈

## 核心框架与语言

- **TypeScript:** 项目的主要编程语言，确保代码的类型安全和可维护性。
- **Vue 3 (Composition API):** 前端框架，利用组合式 API 构建响应式和模块化的 UI 组件。
- **Vite:** 极速的前端构建工具，项目中通过 `rolldown-vite` 进行了定制。

## UI 与样式

- **Ant Design Vue (v4):** 企业级 UI 组件库，用于构建设置页面和弹出窗口。
- **Tailwind CSS:** 实用优先的 CSS 框架，用于快速构建自定义 UI 布局。
- **PostCSS / Less:** 用于预处理 CSS 和样式优化。

## 状态管理与存储

- **Pinia:** Vue 的官方状态管理库，用于管理跨组件和跨上下文（弹出窗口、设置页、内容脚本）的状态。
- **多层存储系统：**
  - **Chrome Storage API:** 用于轻量级设置和跨浏览器实例同步。
  - **Dexie.js (IndexedDB):** 用于存储海量表情包数据，提供高性能的本地持久化。
  - **Native LocalStorage/SessionStorage:** 用于即时读写缓存。

## AI 与外部集成

- **Google Gemini API:** 用于表情包的智能命名和自动分类。
- **Anthropic SDK:** 用于增强的 AI 辅助功能。
- **WebDAV / S3:** 支持第三方云存储协议，实现跨设备手动/自动同步。

## 质量保障与测试

- **Playwright:** 强大的端到端测试框架，专门用于测试浏览器扩展的功能和兼容性。
- **ESLint & Prettier:** 用于代码规范校验和自动化格式化。
- **Vue-TSC:** 用于 Vue 组件的类型检查。

## 构建与发布

- **自定义构建脚本 (`scripts/`):** 包含 CRX/XPI 打包、版本更新、市场元数据同步等自动化流程。
- **Cloudflare Workers (Wrangler):** 用于部署后端 API 和辅助服务。
- **Wasm:** 使用 WebAssembly (如 `libavif-wasm`, `perceptual_hash`) 处理图像性能敏感任务。
