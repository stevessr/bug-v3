# AI 图片生成器 - Vue 重构版本

## 概述

这是一个完全用 Vue 3 重写的 AI 图片生成器，支持多个图片生成提供商，包括 Google Gemini、SiliconFlow、Cloudflare Workers AI 和 Chutes AI。

## 项目结构

### 类型定义
- `src/types/imageGenerator.ts` - 包含所有接口和类型定义

### 图片生成提供商
- `src/utils/imageProviders/BaseProvider.ts` - 基础提供商类
- `src/utils/imageProviders/GeminiProvider.ts` - Google Gemini 提供商
- `src/utils/imageProviders/SiliconFlowProvider.ts` - SiliconFlow 提供商
- `src/utils/imageProviders/CloudflareProvider.ts` - Cloudflare Workers AI 提供商
- `src/utils/imageProviders/ChutesAIProvider.ts` - Chutes AI 提供商
- `src/utils/imageProviders/ProviderManager.ts` - 提供商管理器
- `src/utils/imageProviders/index.ts` - 导出文件

### Vue 组件
- `src/components/ImageGenerator/ApiConfig.vue` - API 配置组件
- `src/components/ImageGenerator/GenerationMode.vue` - 生成模式选择组件
- `src/components/ImageGenerator/ImageUpload.vue` - 图片上传组件
- `src/components/ImageGenerator/PromptInput.vue` - 提示词输入组件
- `src/components/ImageGenerator/GenerationConfig.vue` - 生成配置组件
- `src/components/ImageGenerator/GenerateButton.vue` - 生成按钮组件
- `src/components/ImageGenerator/ResultDisplay.vue` - 结果显示组件
- `src/components/ImageGenerator/ImageGeneratorMain.vue` - 主组件
- `src/components/ImageGenerator/index.ts` - 组件导出文件

### Composables
- `src/composables/useImageGenerator.ts` - 图片生成状态管理

### 视图
- `src/views/ImageGeneratorView.vue` - 页面视图组件

### 独立 HTML 文件
- `image-generator-vue.html` - 可独立运行的 Vue 版本

## 功能特性

### 支持的提供商
1. **Google Gemini** - 支持图片生成和编辑
2. **SiliconFlow** - 使用 Kwai-Kolors/Kolors 模型
3. **Cloudflare Workers AI** - 支持 Flux 1 Schnell 和 Stable Diffusion XL Lightning
4. **Chutes AI** - 支持 Neta Lumina、Chroma 和 JuggernautXL 模型

### 主要功能
- 文本生成图片
- 图片编辑（仅 Gemini）
- 多种宽高比支持
- 艺术风格选择
- 批量生成（1-4张）
- 拖拽上传图片
- 图片下载和链接复制

## 使用方法

### 在 Vue 项目中使用

1. 安装依赖并导入组件：
```vue
<template>
  <ImageGeneratorMain />
</template>

<script setup lang="ts">
import { ImageGeneratorMain } from '@/components/ImageGenerator';
</script>
```

2. 或者使用 composable：
```vue
<script setup lang="ts">
import { useImageGenerator } from '@/composables/useImageGenerator';

const {
  providerManager,
  isGenerating,
  error,
  generatedImages,
  generateImages,
  clearResults
} = useImageGenerator();
</script>
```

### 独立使用

直接打开 `image-generator-vue.html` 文件即可在浏览器中使用。

## 组件说明

### ApiConfig
API 配置组件，用于选择提供商、输入 API Key 和选择模型。

**Props:**
- `providerManager: ProviderManager` - 提供商管理器

**Events:**
- `provider-changed` - 提供商变更
- `api-key-changed` - API Key 变更
- `model-changed` - 模型变更

### GenerationMode
生成模式选择组件，支持文本生成图片和图片编辑模式。

**Props:**
- `providerManager: ProviderManager` - 提供商管理器
- `modelValue: 'generate' | 'edit'` - 当前模式

**Events:**
- `update:modelValue` - 模式更新
- `mode-changed` - 模式变更

### ImageUpload
图片上传组件，支持拖拽上传和点击选择。

**Props:**
- `image?: string` - 当前图片（base64）

**Events:**
- `update:image` - 图片更新
- `image-changed` - 图片变更

### PromptInput
提示词输入组件，根据模式显示不同的占位符。

**Props:**
- `modelValue: string` - 提示词内容
- `isEditMode?: boolean` - 是否为编辑模式

**Events:**
- `update:modelValue` - 内容更新
- `prompt-changed` - 内容变更

### GenerationConfig
生成配置组件，包含数量、宽高比和风格选择。

**Props:**
- `modelValue: { imageCount: number; aspectRatio: string; style: string }` - 配置对象

**Events:**
- `update:modelValue` - 配置更新
- `config-changed` - 配置变更

### ResultDisplay
结果显示组件，展示生成的图片和操作按钮。

**Props:**
- `isLoading: boolean` - 是否加载中
- `error: string | null` - 错误信息
- `images: string[]` - 图片列表

**Events:**
- `download-image` - 下载图片
- `copy-image-url` - 复制图片链接

## 架构优势

1. **模块化设计** - 每个功能都是独立的组件，易于维护和复用
2. **类型安全** - 完整的 TypeScript 类型定义
3. **提供商抽象** - 统一的接口，易于添加新的提供商
4. **状态管理** - 使用 composable 进行状态管理
5. **响应式设计** - 支持移动端和桌面端
6. **错误处理** - 完善的错误处理机制

## 扩展指南

### 添加新的图片生成提供商

1. 创建新的提供商类，继承 `BaseProvider`
2. 实现 `generateImages` 方法
3. 在 `ProviderManager` 中注册新提供商
4. 在 `PROVIDER_CONFIGS` 中添加配置

### 添加新功能

1. 在相应的组件中添加新的 props 和 events
2. 更新类型定义
3. 在 composable 中添加相应的状态和方法

## 注意事项

1. 需要有效的 API Key 才能使用各个提供商的服务
2. 图片编辑功能目前仅支持 Google Gemini
3. 某些提供商可能有使用限制和配额
4. 建议在生产环境中添加适当的错误处理和用户反馈
