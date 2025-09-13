# 编译期开关文档

本项目支持编译期开关来控制日志输出和 IndexedDB 功能。这些开关可以帮助您根据不同环境和需求优化构建产物。

## 可用的开关

### 1. 日志开关 (`ENABLE_LOGGING`)

- **作用**: 控制是否输出日志信息 (console.log, console.warn, console.error)
- **默认值**: 开发环境为 `true`，生产环境可配置
- **影响**:
  - 当设置为 `false` 时，所有日志输出将被移除
  - Terser 会自动删除 console 调用，减小文件大小
  - 提高生产环境性能

### 2. IndexedDB 开关 (`ENABLE_INDEXEDDB`)

- **作用**: 控制是否启用 IndexedDB 读写功能
- **默认值**: `true`
- **影响**:
  - 当设置为 `false` 时，所有 IndexedDB 操作将被跳过
  - 适用于不需要本地存储或在受限环境中运行的场景
  - 减少代码体积和运行时开销

## 构建命令

### 开发环境

```bash
npm run dev
```

- 日志: ✅ 启用
- IndexedDB: ✅ 启用

### 标准生产构建

```bash
npm run build
```

- 日志: ✅ 启用
- IndexedDB: ✅ 启用
- 优化: ✅ 启用

### 生产构建（无日志）

```bash
npm run build:prod
```

- 日志: ❌ 禁用
- IndexedDB: ✅ 启用
- 优化: ✅ 启用
- 特点: 体积更小，性能更好

### 无 IndexedDB 构建

```bash
npm run build:no-indexeddb
```

- 日志: ✅ 启用
- IndexedDB: ❌ 禁用
- 特点: 适合不需要本地存储的环境

### 最小化构建

```bash
npm run build:minimal
```

- 日志: ❌ 禁用
- IndexedDB: ❌ 禁用
- 特点: 最小体积，最高性能，适合资源受限环境

### 油猴脚本构建

```bash
npm run build:userscript
```

- 日志: ✅ 启用
- IndexedDB: ❌ 禁用 (使用 localStorage)
- 特点: 生成油猴脚本，无需浏览器扩展即可使用

### 油猴脚本构建（混淆版）

```bash
npm run build:userscript:min
```

- 日志: ✅ 启用
- IndexedDB: ❌ 禁用 (使用 localStorage)
- 特点: 压缩混淆的油猴脚本，体积更小

## 手动配置环境变量

您也可以通过设置环境变量来手动控制构建配置：

### Windows (Command Prompt)

```cmd
set ENABLE_LOGGING=false
set ENABLE_INDEXEDDB=false
npm run build
```

### Windows (PowerShell)

```powershell
$env:ENABLE_LOGGING="false"
$env:ENABLE_INDEXEDDB="false"
npm run build
```

### Unix/Linux/macOS

```bash
ENABLE_LOGGING=false ENABLE_INDEXEDDB=false npm run build
```

## 代码中的使用

### 1. 日志使用

```typescript
import { logger } from '@/utils/logger'

// 这些调用会根据编译期开关决定是否输出
logger.log('这是一条普通日志')
logger.warn('这是一条警告')
logger.error('这是一条错误日志')
logger.dev('这是开发环境专用日志')
```

### 2. IndexedDB 检查

```typescript
import { indexedDBWrapper } from '@/utils/logger'

// 检查 IndexedDB 是否被禁用
if (indexedDBWrapper.shouldSkip()) {
  // IndexedDB 被禁用，使用替代方案
  return
}

// 检查 IndexedDB 是否启用
if (indexedDBWrapper.isEnabled()) {
  // 执行 IndexedDB 操作
}
```

## 构建优化效果

| 构建类型     | 包大小减少 | 性能提升 | 适用场景           |
| ------------ | ---------- | -------- | ------------------ |
| 标准构建     | 0%         | 0%       | 开发和调试         |
| 无日志构建   | ~10-15%    | ~5-10%   | 生产环境           |
| 无 IndexedDB | ~5-10%     | ~3-5%    | 简化存储需求       |
| 最小化构建   | ~15-25%    | ~10-15%  | 资源受限环境       |
| 油猴脚本     | N/A        | N/A      | 无需扩展的用户脚本 |
| 油猴脚本混淆 | ~15-20%    | ~5-10%   | 体积优化的用户脚本 |

## 注意事项

1. **日志开关**: 禁用日志后将无法在生产环境中调试问题，建议在测试充分后再禁用
2. **IndexedDB 开关**: 禁用 IndexedDB 后需要确保应用有替代的存储方案
3. **兼容性**: 编译期开关不影响运行时兼容性，只影响功能可用性
4. **调试**: 开发环境建议保持所有功能启用以便调试

## 自定义配置

如需添加更多编译期开关，请：

1. 在 `src/config/buildFlags.ts` 中添加新的标志定义 (or add to `@/utils/logger` shim)
2. 在 `vite.config.ts` 中添加对应的环境变量处理
3. 在 `scripts/build.js` 中添加新的构建配置
4. 更新此文档说明新开关的用途
