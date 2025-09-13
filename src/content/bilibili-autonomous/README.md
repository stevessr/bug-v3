# Bilibili Autonomous Content Script - 重构版本

本目录包含了哔哩哔哩网站表情添加功能的重构版本，采用模块化设计，提高了代码的可维护性和可扩展性。

## 📁 文件结构

```
src/content/bilibili-autonomous/
├── 📄 index.ts              # 主入口文件
├── 📄 types.ts              # TypeScript类型定义
├── 📄 config.ts             # 配置常量
├── 📄 utils.ts              # 工具函数和错误处理
├── 📄 README.md             # 说明文档
├── 📂 detectors/            # 检测器模块目录
│   └── 📄 page.ts           # 页面类型检测
└── 📂 processors/           # 处理器模块目录
    └── 📄 url.ts            # URL处理工具
```

## 🔧 模块说明

### 核心文件

- **`index.ts`** - 模块的主入口点，整合各个功能模块
- **`types.ts`** - 包含所有TypeScript类型定义
- **`config.ts`** - 集中管理所有配置项和常量
- **`utils.ts`** - 提供基础工具函数和错误处理

### 检测器模块 (`detectors/`)

- **`page.ts`** - 页面类型检测：
  - 哔哩哔哩域名检测
  - Opus页面识别
  - 页面类型分析

### 处理器模块 (`processors/`)

- **`url.ts`** - URL处理功能：
  - URL规范化（处理协议、尺寸参数）
  - 图片URL提取
  - 文件名提取
  - URL有效性验证

## 🚀 主要改进

### 1. 模块化设计

- 按功能职责清晰分离
- 减少文件间的耦合
- 提高代码复用性

### 2. 类型安全

- 完整的TypeScript类型定义
- 编译时错误检查
- 更好的IDE支持

### 3. 配置管理

- 集中化配置管理
- 易于维护和修改
- 一致的常量使用

### 4. 错误处理

- 统一的错误处理机制
- 详细的日志记录
- 优雅的降级处理

### 5. 性能优化

- 防抖和节流机制
- 智能的DOM观察
- 减少不必要的计算

## 📝 功能特性

### URL处理优化

- ✅ 处理 `//` 开头的URL，自动添加 `https:` 协议
- ✅ 去除 `@` 后面的尺寸参数，获取原图URL
- ✅ 区分展示URL和下载URL
- ✅ 支持多种图片格式 (webp, jpg, jpeg, png, gif, avif)

### 注入逻辑优化

- ✅ 添加对 `pswp__img` 大图的注入支持
- ✅ 过滤掉头像 (`b-avatar__layer__res`) 的注入
- ✅ 优化选择器逻辑，减少误注入

### 按钮交互

- ✅ 悬停显示/隐藏效果
- ✅ 点击状态反馈（加载中、成功、失败）
- ✅ 自动恢复初始状态

## 🔄 与原版本的兼容性

重构版本保持了与原 `bilibili-autonomous.ts` 相同的功能和API接口，可以无缝替换。

## 🐛 调试

启用调试日志：

```typescript
import { logger } from './utils'

// 日志会自动包含时间戳和前缀
logger.debug('调试信息')
logger.info('一般信息')
logger.warn('警告信息')
logger.error('错误信息')
```

## 🔧 扩展指南

- 添加新的检测器：在 `detectors/` 目录下创建新模块
- 添加新的处理器：在 `processors/` 目录下创建新模块
- 修改配置：编辑 `config.ts` 文件
- 添加新的工具函数：编辑 `utils.ts` 文件
