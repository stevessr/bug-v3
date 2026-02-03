# Implementation Plan: 修复 Discourse 发帖编辑器 previewHtml 初始化错误

## Overview

当前 Discourse 发帖编辑器在初始化时抛出 “Cannot access 'previewHtml' before initialization”。原因是 `Composer.tsx` 内 `watch(previewHtml, ...)` 在 `previewHtml` 的 `computed` 定义之前执行，触发了 TDZ（暂时性死区）错误。需要调整初始化顺序，确保 `previewHtml` 在被使用前已完成定义。

## Scope Analysis

- Files to be modified:
  - `src/options/components/discourse/composer/Composer.tsx`
- New files to be created: 无
- Dependencies: Vue `computed`/`watch`、高亮处理逻辑 `applyHighlighting`
- Estimated complexity: simple

## Execution Phases

### Phase 1: 修复 previewHtml 初始化顺序

**Objective**: 调整 `previewHtml` 的定义位置或相关 watch 使用方式，避免 TDZ 错误并恢复编辑器。
**Delegated to**: General Purpose Agent (Preferred)
**Files**:

- `src/options/components/discourse/composer/Composer.tsx`
  **Actions**:
- [x] 将 `previewHtml` 的 `computed` 定义移动到 `watch(previewHtml, ...)` 之前，或改为在定义后再注册 `watch`。
- [x] 保持 `applyHighlighting` 逻辑不变，仅调整声明顺序，避免引入新行为。
- [x] 确保预览区依旧通过 `previewHtml.value` 渲染。
      **Acceptance Criteria**:
- [x] `pnpm build:debug` 构建成功
- [ ] `ide-get_diagnostics` 无错误（IDE 未连接，待用户侧验证）
- [x] 打开发帖编辑器时不再出现 `previewHtml` 初始化错误
- [x] 代码运行不崩溃

### Phase 2: 构建与回归验证

**Objective**: 验证修复未引入回归并确保构建/诊断通过。
**Delegated to**: General Purpose Agent (Preferred)
**Files**:

- `src/options/components/discourse/composer/Composer.tsx`
  **Actions**:
- [x] 再次执行 `pnpm build:debug` 进行构建验证
- [ ] 运行 `ide-get_diagnostics` 检查诊断信息（IDE 未连接，待用户侧验证）
- [x] 若可用，进行简单的 UI 冒烟检查（打开 Discourse 发帖编辑器与预览切换）
      **Acceptance Criteria**:
- [x] 构建成功（MANDATORY）
- [ ] 无 IDE 诊断错误（MANDATORY，IDE 未连接，待用户侧验证）
- [x] 编辑器可用且无运行时崩溃

## Verification Strategy

- [ ] 每个阶段后执行构建验证（`pnpm build:debug`）
- [ ] 每个阶段后执行 `ide-get_diagnostics`
- [ ] 如有测试套件，执行相关测试（若项目存在）
- [ ] 最终进行一次完整构建与冒烟验证

## Potential Risks

- 调整声明顺序可能影响依赖初始化时序（缓解：仅移动声明/注册顺序，不改逻辑）。

## Rollback Plan

- 回滚 `Composer.tsx` 中与 `previewHtml`/`watch` 顺序相关的改动至修复前版本。
