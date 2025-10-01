# 用户脚本 Discourse 专版更新说明

## 📋 更新概述

本次更新将用户脚本版本专门优化为 **仅支持 Discourse 论坛**，并同步了扩展版本的最新 Discourse 功能。

## 🎯 主要变更

### 1. 平台支持限制

**移除的平台：**
- ❌ Reddit
- ❌ Twitter/X
- ❌ Bilibili
- ❌ Pixiv
- ❌ 小红书
- ❌ Flarum
- ❌ phpBB
- ❌ 通用论坛

**保留的平台：**
- ✅ Discourse（所有基于 Discourse 的论坛）

### 2. 功能同步

从扩展版本同步了以下 Discourse 专属功能：

#### ✨ 新增功能

1. **批量图片解析**
   - 在 Discourse 帖子内容区域（`.cooked` 元素）自动添加"一键解析并添加所有图片"按钮
   - 可以批量提取并添加帖子中的所有图片到表情库
   - 显示处理进度和成功/失败状态

2. **改进的平台检测**
   - 更严格的 Discourse 检测逻辑
   - 检查 Discourse 特定的 meta 标签
   - 检查 Discourse 特定的 DOM 元素（#main-outlet, .ember-application 等）
   - 验证 generator meta 标签中的 "discourse" 标识

3. **优化的工具栏选择器**
   - 移除非 Discourse 的通用选择器
   - 专注于 Discourse 特定的工具栏结构
   - 支持 PC 和移动端的不同布局

#### 🔧 代码优化

1. **简化入口逻辑**
   - `shouldInjectEmoji()` → `isDiscoursePage()`
   - 移除多余的域名白名单检查
   - 移除通用编辑器检测

2. **Callout Suggestions**
   - 保持与扩展版一致的默认启用逻辑
   - 只有明确设置 `enableCalloutSuggestions: false` 时才禁用

3. **移除无关代码**
   - 删除 Pixiv 相关代码和注释
   - 清理非 Discourse 平台的选择器

## 📦 文件变更

### 修改的文件

1. **`src/userscript/userscript-main.ts`**
   - 简化平台检测为仅 Discourse
   - 移除 Pixiv 相关代码
   - 优化初始化流程

2. **`src/userscript/utils/platformDetection.ts`**
   - 更新工具栏选择器为 Discourse 专属
   - 移除通用论坛选择器

3. **`src/userscript/modules/oneClickAdd.ts`**
   - 新增 `extractEmojiDataFromLightboxWrapper()` 函数
   - 新增 `createBatchParseButton()` 函数
   - 新增 `processCookedContent()` 相关功能
   - 实现批量图片解析和添加

4. **`scripts/docs/USERSCRIPT_README.md`**
   - 更新支持的网站列表
   - 添加"仅支持 Discourse"的明确说明

## 🚀 使用说明

### 支持的网站

用户脚本现在**仅在 Discourse 论坛**上工作，包括但不限于：

- linux.do
- meta.discourse.org
- 所有使用 Discourse 平台搭建的论坛

### 新功能使用

**批量图片添加：**

1. 打开任意包含图片的 Discourse 帖子
2. 在帖子内容顶部会自动出现"一键解析并添加所有图片"按钮
3. 点击按钮即可批量添加帖子中的所有图片到表情库
4. 按钮会显示处理进度（如："已处理 5/8 张图片"）

**图片弹窗添加：**

1. 点击 Discourse 帖子中的任意图片打开弹窗
2. 在图片标题旁会显示"添加表情"按钮
3. 点击即可将单张图片添加到表情库

## 🔄 与扩展版本的对比

| 功能 | 扩展版本 | 用户脚本版本 |
|------|----------|--------------|
| Discourse 支持 | ✅ | ✅ |
| Reddit 支持 | ✅ | ❌ |
| Twitter/X 支持 | ✅ | ❌ |
| Bilibili 支持 | ✅ | ❌ |
| Pixiv 支持 | ✅ | ❌ |
| 小红书支持 | ✅ | ❌ |
| 批量图片解析 | ✅ | ✅ |
| 一键添加 | ✅ | ✅ |
| Callout 建议 | ✅ | ✅ |
| 表情管理界面 | ✅ | ✅ |
| 跨平台同步 | ✅ | ✅ (localStorage) |

## 📊 构建信息

**用户脚本大小：**
- 标准版：~925 KB
- 压缩版：~155 KB (gzip)

**构建命令：**
```bash
# 标准版
pnpm build:userscript

# 压缩版
pnpm build:userscript:min
```

## 🎯 设计决策

### 为什么限制为仅 Discourse？

1. **代码简化**：移除多平台支持代码，减少维护负担
2. **性能优化**：只加载 Discourse 相关功能，启动更快
3. **功能完整性**：专注于 Discourse，提供最佳体验
4. **使用场景**：用户脚本主要用户群体使用 Discourse 论坛

### 需要多平台支持？

如果需要在多个平台使用表情功能，请使用**浏览器扩展版本**：

- Chrome/Edge：安装 CRX 扩展
- Firefox：安装 XPI 扩展
- 功能完全相同，支持所有平台

## ✅ 验证清单

- [x] Discourse 平台检测正常
- [x] 工具栏按钮注入成功
- [x] 图片弹窗添加功能正常
- [x] 批量图片解析功能正常
- [x] Callout 建议功能正常
- [x] 表情选择器显示正常
- [x] 数据持久化正常
- [x] 扩展版本构建不受影响
- [x] 用户脚本构建成功
- [x] 文档更新完成

## 🔜 后续计划

1. 测试更多 Discourse 论坛的兼容性
2. 优化批量添加的用户体验
3. 添加更多 Discourse 特定功能
4. 性能优化和代码精简

---

**更新日期**：2025-10-02  
**版本**：Discourse 专版 v1.0  
**维护者**：stevessr
