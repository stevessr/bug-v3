# Brotli 压缩功能说明 (破坏性更新)

## 概述

为了优化浏览器插件的加载性能，我们为 `src/config/default.json` 文件实现了 brotli 压缩功能。

**⚠️ 破坏性更新：只支持压缩版本，不提供降级方案！**

## 功能特性

### 1. 强制压缩
- 在构建过程中，`src/config/default.json` 会被自动压缩为 `public/assets/defaultEmojiGroups.json.br`
- 压缩率约 89%（从 476KB 压缩到 53KB）
- **不再生成未压缩版本**

### 2. 严格加载
- 运行时**只**加载压缩版本
- 如果浏览器不支持 brotli，**直接报错**
- **不提供任何降级方案**

### 3. 浏览器要求
- **必须**支持 `DecompressionStream` API
- 不支持的浏览器将无法使用
- 无需额外的第三方库

## 文件结构

```
src/
├── config/
│   └── default.json                    # 原始配置文件
├── utils/
│   └── brotliLoader.ts                 # brotli 加载器
└── types/
    └── defaultEmojiGroups.loader.ts    # 配置加载器

public/assets/
└── defaultEmojiGroups.json.br          # 压缩版本（唯一版本）

scripts/
└── build.js                           # 构建脚本（包含压缩逻辑）
```

## 使用方法

### 构建时压缩
```bash
npm run build        # 生成压缩文件
npm run dev          # 开发模式也只生成压缩文件
```

### 运行时加载
```typescript
import { loadDefaultEmojiGroups } from '@/types/defaultEmojiGroups.loader'

// 只加载压缩版本，失败时抛出错误
const groups = await loadDefaultEmojiGroups()
```

## 压缩效果

| 版本 | 大小 | 压缩率 |
|------|------|--------|
| 原始文件 | 487,895 字节 (476 KB) | - |
| Brotli 压缩 | 54,150 字节 (53 KB) | 89% |

## 浏览器支持

- ✅ Chrome 80+ (支持 DecompressionStream)
- ✅ Firefox 65+ (支持 DecompressionStream)
- ✅ Safari 16.4+ (支持 DecompressionStream)
- ✅ Edge 80+ (支持 DecompressionStream)
- ❌ 旧版浏览器**不支持**，将报错

## 测试

访问 `/test-brotli.html` 页面可以测试压缩功能：

1. 检查浏览器 brotli 支持
2. 测试加载压缩文件
3. **不再提供降级测试**

## 技术实现

### 压缩（构建时）
```javascript
import { brotliCompressSync } from 'zlib'

const jsonString = JSON.stringify(data, null, 2)
const compressedData = brotliCompressSync(Buffer.from(jsonString, 'utf-8'))
fs.writeFileSync(outputPath + '.br', compressedData)
```

### 解压缩（运行时）
```javascript
const response = await fetch('/assets/defaultEmojiGroups.json.br')
const compressedData = await response.arrayBuffer()

const stream = new DecompressionStream('br')
// ... 解压缩逻辑
```

## 注意事项

1. **服务器配置**：确保服务器正确设置 `.br` 文件的 MIME 类型
2. **缓存策略**：压缩文件可以设置更长的缓存时间
3. **错误处理**：**不提供降级机制**，浏览器不支持时直接报错
4. **开发调试**：开发模式也只有压缩版本，需要支持 brotli 的浏览器

## 性能提升

- **加载速度**：文件大小减少 89%，显著提升加载速度
- **带宽节省**：减少网络传输数据量
- **用户体验**：更快的插件启动时间
- **服务器负载**：减少服务器带宽消耗

## 维护说明

- 修改 `src/config/default.json` 后重新构建即可自动更新压缩版本
- 压缩逻辑集成在构建脚本中，无需手动操作
- 测试页面可用于验证压缩功能是否正常工作
- **重要**：确保目标用户的浏览器支持 DecompressionStream API