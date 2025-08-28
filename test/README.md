# 测试目录结构说明

本项目采用标准化的测试目录结构，所有测试文件都已按照类型和用途进行分类和重命名，统一添加了 `test` 特征标识。

## 目录结构

```
test/
├── unit/                    # 单元测试
│   ├── *.unit.test.ts      # TypeScript 单元测试文件
│   └── *.unit.test.js      # JavaScript 单元测试文件
├── integration/            # 集成测试
│   └── *.integration.test.ts # 集成测试文件
├── verification/           # 验证测试
│   ├── *.test.ts          # 验证测试文件
│   └── *.test.js          # 验证脚本文件
├── utils/                  # 测试工具
│   └── setupTests.ts      # 测试配置和设置
└── mock/                   # 模拟数据 (预留)

e2e/                        # 端到端测试
├── *.e2e.test.ts          # Playwright E2E测试
├── *.e2e.test.js          # JavaScript E2E测试
├── *.e2e.test.cjs         # CommonJS E2E测试
└── e2e-utils.ts           # E2E测试工具
```

## 文件命名规范

所有测试文件均采用以下命名规范，包含明确的测试类型标识：

- **单元测试**: `[功能名称].unit.test.[ts|js]`
- **集成测试**: `[功能名称].integration.test.[ts|js]`
- **端到端测试**: `[功能名称].e2e.test.[ts|js|cjs]`
- **验证测试**: `[功能名称].test.[ts|js]`

## 测试文件分类

### 单元测试 (test/unit/)

- `App.unit.test.ts` - 主应用组件测试
- `OpenRouterChat.unit.test.ts` - OpenRouter聊天组件测试
- `content-script-sync.unit.test.ts` - 内容脚本同步测试
- `data-separation-refactor.unit.test.ts` - 数据分离重构测试
- `emoji-insert-fix.unit.test.ts` - 表情插入修复测试
- `emoji-settings-realtime.unit.test.ts` - 表情设置实时测试
- `grid-columns.unit.test.ts` - 网格列数测试
- `new-group-icon.unit.test.ts` - 新分组图标测试
- `popup-duplicate-common-fix.unit.test.ts` - popup重复显示修复测试

### 集成测试 (test/integration/)

- `openrouter.integration.test.ts` - OpenRouter API集成测试

### 验证测试 (test/verification/)

- `background-communication.test.js` - 后台通信验证
- `fixes-verification.test.ts` - 修复功能验证
- `manual-test-runner.test.js` - 手动测试运行器
- `popup-cache-fixes-verification.test.ts` - popup缓存修复验证
- `verify-background-storage.test.js` - 后台存储验证
- `verify-data-separation.test.js` - 数据分离验证

### 端到端测试 (e2e/)

- `background-emoji-loading.e2e.test.ts` - 后台表情加载E2E测试
- `emoji-insert-fix.e2e.test.ts` - 表情插入修复E2E测试
- `emoji-realtime-settings.e2e.test.ts` - 表情实时设置E2E测试
- `emoji-usage-recording.e2e.test.ts` - 表情使用记录E2E测试
- `grid-columns.e2e.test.ts` - 网格列数E2E测试
- `inject-*.e2e.test.ts` - 注入相关E2E测试
- `mobile-modal-*.e2e.test.ts` - 移动端模态相关E2E测试
- `modal-container-*.e2e.test.ts` - 模态容器相关E2E测试
- `record-meta-login.e2e.test.js` - 元数据登录记录E2E测试
- `reset-settings.e2e.test.ts` - 设置重置E2E测试
- `sync.e2e.test.ts` - 同步功能E2E测试
- `vue.e2e.test.ts` - Vue组件E2E测试

### 测试工具 (test/utils/)

- `setupTests.ts` - 测试环境配置和全局设置
- `e2e-utils.ts` - E2E测试工具函数

## 运行测试

```bash
# 运行所有单元测试
npm run test:unit

# 运行所有E2E测试
npm run test:e2e

# 运行集成测试
npm run test:integration

# 运行验证测试
npm run test:verification
```

## 重构说明

本次重构完成了以下工作：

1. **统一命名规范**: 所有测试文件都添加了 `.test.` 特征标识
2. **分类整理**: 按照测试类型将文件移动到对应目录
3. **清理结构**: 删除了空的测试目录，整合了分散的测试文件
4. **标准化**: 采用业界标准的测试目录结构

这样的结构使得测试文件更加清晰易管理，便于CI/CD流程的配置和执行。
