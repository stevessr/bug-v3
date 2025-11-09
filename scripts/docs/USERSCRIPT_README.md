# 油猴脚本构建目标

本项目现在支持构建为油猴脚本 (Tampermonkey/Greasemonkey 用户脚本)，提供与浏览器扩展**完全相同**的表情功能，包括完整的管理界面。

## 🚀 最新功能

### ✨ 完整功能支持

- **✅ 所有扩展功能**：表情选择、搜索、添加、管理
- **✅ 设置面板**：图片缩放、输出格式、界面选项
- **✅ 数据管理**：导入/导出、同步功能
- **✅ 完整管理界面**：独立的 HTML 管理器

### 📦 双重方案

1. **增强用户脚本** - 包含所有基础功能 + 管理入口
2. **独立管理界面** - 提供扩展级别的完整管理功能

## 构建命令

### 标准版本

```bash
npm run build:userscript
```

生成未压缩的用户脚本，便于调试和理解代码。

### 混淆版本

```bash
npm run build:userscript:min
```

生成压缩混淆的用户脚本，体积更小，加载更快。

## 生成的文件

构建完成后，会在 `dist/` 目录下生成以下文件：

### 核心脚本（二选一）

**推荐：模块化安装**

- `emoji-picker-core.remote.user.js` - 表情选择器核心 (~176KB)
  - 包含：表情选择器、工具栏注入、批量添加
  - 不包含：管理界面、设置面板、导入导出、Callout 建议
  - 适合：只需要使用表情的用户

- `emoji-manager.remote.user.js` - 表情管理器 (~85KB)
  - 包含：设置面板、导入/导出、分组编辑、完整管理界面
  - 不包含：表情选择器（需要配合核心脚本使用，或独立管理表情）
  - 适合：需要管理表情、调整设置的用户

**使用建议：**

- 只想用表情：安装 `emoji-picker-core`
- 需要管理表情：同时安装两个脚本
- 只想管理不选择：只安装 `emoji-manager`

### 独立功能脚本

以下功能已分离为独立的用户脚本，可按需安装：

- `scripts/callout-suggestions.user.js` - Callout 自动建议功能 (~21KB)
  - Markdown callout 自动补全
  - 支持 textarea 和 ProseMirror 编辑器
  - 键盘导航（方向键、Tab、Enter）
  - 30+ 内置 callout 类型（note、warning、tip 等）
  - 遵从全局强制移动模式设置
  - 可独立使用，不依赖主脚本
- `scripts/preview-button.user.js` - 话题预览按钮功能 (~24KB)
  - 在 Discourse 话题列表中添加预览按钮
  - 支持三种预览模式：原始、Markdown、JSON
  - 可独立使用，不依赖主脚本
- `scripts/userscript-upload.user.js` - 图片上传功能 (~28KB)
  - 独立的图片上传界面
  - 支持批量上传和管理

## 安装方法

1. 安装油猴脚本管理器：
   - Chrome/Edge: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) 或 [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
   - Safari: [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

2. 安装用户脚本：
   - 点击生成的 `.user.js` 文件
   - 或者复制文件内容，在油猴脚本管理器中创建新脚本并粘贴

3. 下载管理界面（可选）：
   - 保存 `emoji-manager.html` 到本地
   - 在浏览器中打开使用完整管理功能

## 功能特性

### 支持的网站

**仅支持 Discourse 论坛：**

- linux.do
- meta.discourse.org
- 所有基于 Discourse 的论坛网站

> **注意**：用户脚本版本专门为 Discourse 论坛优化，不支持其他平台（如 Reddit、Twitter、Pixiv 等）。如需多平台支持，请使用浏览器扩展版本。

### 🎯 核心功能（emoji-picker-core.user.js）

- **表情选择器**: 点击工具栏中的猫咪图标 🐈‍⬛ 打开表情选择器
- **本地存储**: 使用 localStorage 存储用户设置和自定义表情
- **一键添加**: 在图片弹窗中点击"添加表情"按钮将图片添加到表情库
- **搜索功能**: 在表情选择器中搜索表情名称
- **自适应布局**: 根据页面环境自动选择最佳显示方式

### 🔧 管理功能（emoji-manager.user.js）

- **设置面板**: 配置缩放比例、输出格式等
- **完整管理界面**: 分组创建、编辑、删除；表情添加、编辑、移除
- **导入/导出**: 数据备份和迁移功能
- **拖拽排序**: 可视化管理表情顺序
- **收藏夹管理**: 管理常用表情

### 🔌 可选独立功能

以下功能可作为独立脚本安装（与主脚本分离，可按需选择）：

- **Callout 自动建议** (`scripts/callout-suggestions.user.js`):
  - Markdown callout 自动补全功能
  - 输入 `[` 触发建议列表
  - 支持 30+ callout 类型（note、warning、tip、success、danger 等）
  - 键盘导航和图标显示
  - 遵从全局强制移动模式设置
  - 不依赖主脚本，可单独使用

- **话题预览按钮** (`scripts/preview-button.user.js`):
  - 在话题列表中添加预览按钮
  - 支持原始格式、Markdown、JSON 三种预览模式
  - 支持分页浏览和键盘导航
  - 不依赖主脚本，可单独使用

### 与浏览器扩展的差异

| 特性     | 浏览器扩展     | 油猴脚本（核心+管理）   |
| -------- | -------------- | ----------------------- |
| 安装方式 | 扩展商店       | 用户脚本管理器          |
| 存储方式 | chrome.storage | localStorage            |
| 后台通信 | chrome.runtime | 无 (自包含)             |
| 更新方式 | 自动更新       | 手动更新或脚本自动检查  |
| 权限要求 | 扩展权限       | 无特殊权限              |
| 跨浏览器 | 需要不同扩展   | 通用兼容                |
| 功能模块 | 一体化         | 可分离安装（核心/管理） |

## 技术实现

### 存储适配

- 使用 `localStorage` 替代 `chrome.storage`
- 实现了完整的存储适配层 (`src/userscript/userscript-storage.ts`)
- 支持表情分组和用户设置的持久化存储

### 自包含设计

- 移除了对 Chrome 扩展 API 的依赖
- 集成了默认表情数据
- 实现了独立的表情管理功能

### 构建优化

- 使用专门的 Vite 配置 (`vite.config.userscript.ts`)
- 自动注入用户脚本元数据头
- 支持代码压缩和混淆

## 开发和调试

### 开发环境

```bash
# 构建标准版本用于调试
npm run build:userscript

# 安装生成的脚本到油猴脚本管理器
# 在支持的网站上测试功能
```

### 添加新功能

1. 修改 `src/userscript/userscript-main.ts`
2. 如需存储功能，更新 `src/userscript/userscript-storage.ts`
3. 重新构建并测试

### 调试技巧

- 使用浏览器开发者工具查看控制台日志
- 标准版本包含详细的调试信息
- 可以在油猴脚本管理器中直接编辑脚本进行快速测试

## 兼容性

### 浏览器支持

- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+

### 论坛平台支持

- Discourse (所有版本)
- 其他类似结构的论坛 (通过 CSS 选择器适配)

## 故障排除

### 常见问题

1. **表情按钮没有出现**
   - 检查网站是否在支持列表中
   - 查看控制台是否有错误信息
   - 确认脚本已正确安装并启用

2. **表情选择器无法打开**
   - 检查 localStorage 是否可用
   - 查看控制台错误信息
   - 尝试重新加载页面

3. **添加的表情丢失**
   - 检查浏览器的 localStorage 设置
   - 确认没有清理浏览器数据
   - 备份重要的自定义表情

### 日志调试

脚本包含详细的日志输出，前缀为 `[Emoji Extension Userscript]`，可以通过浏览器控制台查看运行状态。

## 更新说明

油猴脚本支持自动更新检查，当有新版本时会提示更新。也可以手动下载最新版本的脚本文件进行更新。

## 许可证

本项目采用 MIT 许可证，生成的用户脚本同样遵循该许可证。
