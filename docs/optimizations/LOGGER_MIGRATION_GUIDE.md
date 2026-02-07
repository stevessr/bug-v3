# 统一日志管理迁移指南

## 📋 概述

当前代码库中有 **477 个 console 调用**分布在 94 个文件中：

- Content scripts: 268 个调用 (47 个文件)
- Background scripts: 44 个调用 (11 个文件)
- Options pages: 165 个调用 (36 个文件)

## 🎯 目标

使用统一的 `logger.ts` 替代直接的 `console.*` 调用，以实现：

- ✅ 统一的日志格式
- ✅ 可配置的日志级别
- ✅ 生产环境自动过滤
- ✅ 日志缓冲和导出
- ✅ 更好的调试体验

## 🚀 迁移策略

### 渐进式迁移（推荐）

采用**渐进式迁移**而非一次性全部替换：

1. ✅ 新代码强制使用 logger
2. 📝 逐步迁移高频文件
3. 🔧 保留低优先级文件的 console

### 优先级

#### 🔴 高优先级（建议迁移）

- [x] 新创建的文件（platformDetector.ts, platformLoader.ts 等）
- [ ] content/discourse/\* (17 个调用 - 核心功能)
- [ ] background/handlers/\* (核心业务逻辑)
- [ ] stores/emojiStore.ts (状态管理)

#### 🟡 中优先级（可选）

- [ ] content/pixiv/\* (10+ 调用)
- [ ] content/bilibili/\* (10+ 调用)
- [ ] options/pages/\* (UI 逻辑)

#### 🟢 低优先级（保持现状）

- [ ] 工具函数（一次性调用）
- [ ] 测试/调试代码
- [ ] 第三方集成代码

## 📝 迁移步骤

### 1. 标准迁移模板

**迁移前：**

```typescript
console.log('[MyFeature] Initialization started')
console.warn('[MyFeature] Config missing, using defaults')
console.error('[MyFeature] Failed to load', error)
```

**迁移后：**

```typescript
import { createLogger } from '@/utils/logger'

const log = createLogger('MyFeature')

log.info('Initialization started')
log.warn('Config missing, using defaults')
log.error('Failed to load', error)
```

### 2. Vue 组件迁移

**迁移前：**

```vue
<script setup lang="ts">
const handleClick = () => {
  console.log('Button clicked')
}
</script>
```

**迁移后：**

```vue
<script setup lang="ts">
import { createLogger } from '@/utils/logger'

const log = createLogger('MyComponent')

const handleClick = () => {
  log.info('Button clicked')
}
</script>
```

### 3. 批量迁移工具

我们提供了自动化迁移脚本：

```bash
# 预览模式（不修改文件）
node scripts/migrate-to-logger.js --dry-run

# 详细输出
node scripts/migrate-to-logger.js --dry-run --verbose

# 执行迁移
node scripts/migrate-to-logger.js

# 迁移后检查
pnpm type-check
pnpm lint:fix
```

## 🎨 日志级别使用指南

### DEBUG (开发环境)

用于详细的调试信息：

```typescript
log.debug('Processing emoji', { id, name, url })
log.debug('Cache hit', cacheKey)
```

### INFO (默认)

用于重要的状态变更：

```typescript
log.info('Platform detected: pixiv')
log.info('Module loaded successfully')
log.info('User logged in')
```

### WARN (警告)

用于非致命错误或降级处理：

```typescript
log.warn('Failed to load cache, using defaults')
log.warn('Deprecated API used')
log.warn('Rate limit approaching')
```

### ERROR (错误)

用于需要关注的错误：

```typescript
log.error('Failed to save data', error)
log.error('Network request failed', { url, status })
log.error('Initialization failed', error)
```

## 📊 最佳实践

### 1. 上下文命名

**好的上下文名称：**

```typescript
createLogger('DiscourseContent') // 明确的功能
createLogger('EmojiStore') // 清晰的模块
createLogger('PixivDetector') // 具体的组件
```

**避免：**

```typescript
createLogger('utils') // 太宽泛
createLogger('file1') // 无意义
createLogger('temp') // 临时名称
```

### 2. 结构化日志

**推荐：**

```typescript
log.info('User action', { action: 'click', target: 'button', userId })
log.error('API call failed', { endpoint, statusCode, error })
```

**避免：**

```typescript
log.info(`User ${userId} clicked button`) // 难以解析
log.error('Error: ' + error.toString()) // 丢失结构
```

### 3. 性能考虑

```typescript
// ✅ 好：条件日志
if (log.level <= LogLevel.DEBUG) {
  log.debug('Expensive operation', computeExpensiveData())
}

// ❌ 差：总是计算
log.debug('Expensive operation', computeExpensiveData())
```

## 🔧 生产环境配置

Logger 会自动根据环境调整行为：

**开发环境 (`NODE_ENV=development`):**

- 日志级别：DEBUG
- 所有日志输出到 console
- 保留详细信息

**生产环境 (`NODE_ENV=production`):**

- 日志级别：WARN
- 只输出警告和错误
- 自动过滤 debug/info 日志

## 📈 迁移进度追踪

### 已完成 ✅

- [x] platformDetector.ts
- [x] platformLoader.ts
- [x] content.ts (部分)

### 进行中 🔄

- [ ] content/discourse/\*
- [ ] background/handlers/\*

### 待迁移 📋

- [ ] 其他 content scripts
- [ ] options pages
- [ ] stores

## 🧪 验证

迁移后，确保进行以下检查：

### 1. 类型检查

```bash
pnpm type-check
```

### 2. 构建测试

```bash
pnpm build
```

### 3. 手动测试

- [ ] 在开发模式下查看日志输出
- [ ] 在生产模式下验证日志级别
- [ ] 测试所有迁移的功能

### 4. 日志质量检查

```typescript
// 在浏览器 console 中
logger.getLogs() // 查看最近日志
logger.exportLogs() // 导出所有日志
```

## 📝 注意事项

### 1. 保留的 console 调用

以下情况**可以保留** console:

- 关键错误处理（fallback）
- 第三方库集成
- 临时调试代码（应该加 TODO 注释）

### 2. 兼容性

- Logger 在所有上下文中可用（background, content, popup, options）
- 支持 TypeScript 严格模式
- 无外部依赖

### 3. 性能影响

- 日志调用开销：~0.1ms
- 内存占用：~100KB (100 条日志)
- 生产环境几乎无开销（被过滤）

## 🚫 反模式

### 避免这些做法

```typescript
// ❌ 在生产代码中保留 console.log
console.log('Debug info')

// ❌ 混用 console 和 logger
console.log('Starting')
log.info('Started')

// ❌ 无上下文的日志
log.info('Error') // 什么错误？

// ❌ 过度日志
log.info('Step 1')
log.info('Step 2')
log.info('Step 3')
```

### 推荐做法

```typescript
// ✅ 统一使用 logger
log.info('Initialization started')
log.info('Initialization completed')

// ✅ 有意义的上下文
log.error('Failed to initialize database', { error, dbName })

// ✅ 适当的日志密度
log.info('Processing batch', { total: items.length })
// ... 处理 ...
log.info('Batch completed', { processed, failed })
```

## 🎓 学习资源

### Logger API 文档

查看 [src/utils/logger.ts](../../src/utils/logger.ts) 了解完整 API

### 示例代码

参考已迁移的文件：

- [platformDetector.ts](../../src/content/utils/platformDetector.ts)
- [platformLoader.ts](../../src/content/utils/platformLoader.ts)
- [content.ts](../../src/content/content.ts)

## 🤝 贡献指南

### 提交迁移的 PR

1. 选择一个模块开始迁移
2. 运行迁移脚本或手动迁移
3. 测试所有功能
4. 提交 PR 并注明迁移范围

### PR 检查清单

- [ ] 类型检查通过
- [ ] 构建成功
- [ ] 手动测试通过
- [ ] 日志输出正确
- [ ] 无遗留的 console 调用（除非有充分理由）

---

**最后更新：** 2026-01-10
**状态：** 📋 进行中
**负责人：** 开发团队
**下一个里程碑：** 迁移 20% 的 console 调用
