# Pixiv 内容脚本代码结构说明

本目录包含了Pixiv网站表情添加功能的完整实现，采用模块化设计，提高了代码的可维护性和可扩展性。

## 📁 文件结构

```
src/content/pixiv/
├── 📄 index.ts          # 主入口文件
├── 📄 pixiv.ts          # 站点专用入口
├── 📄 detector.ts       # 主检测逻辑（整合各模块）
├── 📄 button.ts         # 按钮相关功能
├── 📄 types.ts          # TypeScript类型定义
├── 📄 config.ts         # 配置常量
├── 📄 utils.ts          # 工具函数和错误处理
├── 📄 helpers.ts        # 向后兼容的helpers导出
├── 📂 helpers/          # 功能模块目录
│   ├── 📄 index.ts      # helpers模块入口
│   ├── 📄 url.ts        # URL处理工具
│   ├── 📄 image.ts      # 图片处理工具
│   └── 📄 background.ts # 后台通信工具
└── 📂 detectors/        # 检测器模块目录
    ├── 📄 index.ts      # detectors模块入口
    ├── 📄 page.ts       # 页面类型检测
    ├── 📄 scanner.ts    # 元素扫描
    └── 📄 observer.ts   # DOM观察器
```

## 🔧 模块说明

### 核心文件

- **`index.ts`** - 模块的主入口点，导出核心初始化函数
- **`pixiv.ts`** - 为per-site content bundle提供的专用入口
- **`detector.ts`** - 整合各个检测模块，实现主要的初始化逻辑
- **`button.ts`** - 管理表情按钮的创建、状态和事件处理

### 配置和类型

- **`types.ts`** - 包含所有TypeScript类型定义，包括：
  - 基础数据类型 (`AddEmojiButtonData`)
  - 响应类型 (`EmojiAddResponse`)
  - 按钮状态枚举 (`ButtonState`)
  - 配置类型 (`ButtonConfig`, `DomSelectors`)
  - 日志类型 (`LogLevel`)
  - 后台通信类型

- **`config.ts`** - 集中管理所有配置项：
  - DOM选择器配置
  - 按钮样式和图标配置
  - 常量定义（域名、延迟、默认值等）
  - 网络请求配置

### 工具模块

- **`utils.ts`** - 提供基础工具函数：
  - 统一的日志记录系统
  - 错误处理和重试机制
  - 防抖和节流函数
  - 安全执行包装器

### 功能模块 (`helpers/`)

模块化的功能实现，按职责分离：

- **`url.ts`** - URL相关处理：
  - 从URL提取文件名
  - URL有效性验证
  - Pixiv图片URL标准化
  - 文件名安全处理

- **`image.ts`** - 图片处理功能：
  - Canvas方式获取图片
  - 直接fetch获取图片
  - 图片数据验证
  - 图片尺寸获取

- **`background.ts`** - 后台通信：
  - Chrome扩展API检查
  - 消息发送和响应处理
  - 完整的表情添加流程
  - 错误处理和重试

### 检测器模块 (`detectors/`)

专门负责页面检测和元素扫描：

- **`page.ts`** - 页面类型检测：
  - Pixiv域名检测
  - meta标签分析
  - 页面类型识别

- **`scanner.ts`** - 元素扫描：
  - Pixiv查看器识别
  - 表情数据提取
  - 图片元素扫描
  - 容器状态检查

- **`observer.ts`** - DOM观察：
  - 变化监听
  - 防抖扫描
  - 性能优化

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

### 6. 向后兼容

- 保持原有API接口
- 平滑的迁移路径
- 最小化破坏性变更

## 📝 使用说明

### 基本使用

```typescript
import { initPixiv } from './index'

// 初始化Pixiv表情添加功能
initPixiv()
```

### 自定义配置

如需修改配置，请编辑 `config.ts` 文件中的相应常量。

### 扩展功能

- 添加新的检测器：在 `detectors/` 目录下创建新模块
- 添加新的工具函数：在 `helpers/` 目录下创建新模块
- 修改按钮行为：编辑 `button.ts` 文件

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

## 🔄 迁移指南

从旧版本迁移时，主要的导入路径保持不变：

- `initPixiv` 函数依然从主入口导出
- `AddEmojiButtonData` 类型定义保持一致
- 原有的 `helpers.ts` 文件保持向后兼容

新的模块化结构提供了更好的开发体验和维护性，同时保持了API的稳定性。
