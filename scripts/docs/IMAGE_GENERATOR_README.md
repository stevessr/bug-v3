# AI 图片生成器 - Vue 重构版本

## 概述

这是一个完全用 Vue 3 重写的 AI 图片生成器，支持多个图片生成提供商，包括 Google Gemini、SiliconFlow、Cloudflare Workers AI 和 Chutes AI。

## 项目结构

### 类型定义

- Image generator feature removed from repository. Relevant types and components were deleted.

### 图片生成提供商

- `src/utils/imageProviders/BaseProvider.ts` - 基础提供商类
- `src/utils/imageProviders/GeminiProvider.ts` - Google Gemini 提供商
- `src/utils/imageProviders/SiliconFlowProvider.ts` - SiliconFlow 提供商

> 注意：AI 图片生成功能已从代码库中移除。早期实现及其 Vue 组件、composable 和类型定义在重构中被删除。

如果需要恢复该功能，请参考仓库历史或联系维护者以获取先前的实现备份。
