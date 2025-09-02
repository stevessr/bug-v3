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

```markdown
# AI 图片生成器 - 已移除

此仓库中的 AI 图片生成功能（包括 `image-generator.html` / `image-generator-vue.html` 以及相关 Vue 组件和类型）已从代码库中移除。

保留的与图片生成相关的底层 provider 概要（用于参考）：

- `src/utils/imageProviders/` 下保留若干 provider 实现（例如 Gemini、Cloudflare、SiliconFlow、ChutesAI）用于参考实现，但上层 UI/组件已经删除。

如果您希望恢复该功能，建议的步骤：

1. 恢复或重建 `src/components/ImageGenerator` 下的 Vue 组件和 `src/composables/useImageGenerator.ts`。
2. 重新添加类型定义（`src/types/imageGenerator.ts`）或在 provider 层定义最小接口。
3. 在 `vite.config.ts` 中恢复相应的 build 输入项并重建。
```

- `src/components/ImageGenerator/index.ts` - 组件导出文件
