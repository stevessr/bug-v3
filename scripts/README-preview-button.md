# Discourse 话题预览按钮 (Topic Preview Button)

这是一个独立的 Tampermonkey/Greasemonkey 用户脚本，为 Discourse 论坛话题列表添加预览按钮功能。

## 功能特性

### 🎯 主要功能

- **话题预览**: 在话题列表中为每个话题添加预览按钮
- **多种预览模式**:
  - 原始格式（iframe）：直接加载 `/raw/<id>?page=N` 页面
  - Markdown 模式：渲染 Markdown 为 HTML 显示
  - JSON 模式：解析话题 JSON 数据并格式化显示
- **分页浏览**: 支持前后翻页查看长话题
- **键盘导航**: 
  - 左右箭头键：翻页
  - ESC 键：关闭预览窗口
- **自动分页**: JSON 模式支持滚动自动加载下一页

### 🔌 独立运行

- 不依赖主 emoji-extension 脚本
- 可以单独安装和使用
- 轻量级设计，不影响页面性能

## 安装方法

### 前提条件

1. 安装油猴脚本管理器：
   - Chrome/Edge: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Safari: [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### 安装脚本

方法 1: 从 GitHub Release 安装
```
https://github.com/stevessr/bug-v3/releases/latest/download/preview-button.user.js
```

方法 2: 手动安装
1. 打开 `scripts/preview-button.user.js` 文件
2. 复制全部内容
3. 在 Tampermonkey 管理面板创建新脚本
4. 粘贴内容并保存

## 使用方法

1. 访问任意 Discourse 论坛（如 linux.do）
2. 进入话题列表页面
3. 每个话题标题旁会出现两个预览按钮：
   - **预览**: 使用原始格式（iframe）预览
   - **预览 (JSON)**: 使用 JSON 格式化预览
4. 点击按钮打开预览窗口
5. 使用窗口内的控制按钮或键盘导航

## 支持的网站

- linux.do
- meta.discourse.org
- 所有基于 Discourse 的论坛网站
- localhost:5173（开发环境）
- idcflare.com

## 预览模式说明

### 原始格式（iframe）
- 直接嵌入 Discourse 的 `/raw/<id>` 页面
- 保留原始格式和样式
- 加载速度快

### Markdown 模式（已移除按钮，可通过代码启用）
- 获取原始 Markdown 并渲染为 HTML
- 自动处理图片链接（upload:// 协议）
- 支持基本 Markdown 语法

### JSON 格式
- 解析话题的 JSON 数据
- 逐楼显示帖子内容
- 支持滚动自动加载下一页
- 保留帖子的 HTML 格式

## 技术实现

### 核心组件

- **createEl**: 元素创建辅助函数
- **ensureStyleInjected**: 样式注入管理
- **createOverlay**: 预览窗口管理
- **injectIntoTopicList**: 按钮注入逻辑

### 渲染引擎

- 简单 Markdown 渲染器（内置）
- markdown-it 动态加载（可选，用于更好的 Markdown 支持）
- JSON 数据解析和格式化

### 自动检测

脚本会自动检测当前页面是否为 Discourse 论坛：
- 检查 meta 标签
- 检查特定 DOM 元素
- 只在 Discourse 站点上激活

## 开发和调试

### 文件位置

```
scripts/preview-button.user.js
```

### 调试技巧

1. 打开浏览器控制台查看日志（前缀 `[Preview Button]`）
2. 在 Tampermonkey 管理面板中直接编辑脚本进行测试
3. 检查网络请求确认数据加载正常

### 修改预览模式

在 `createTriggerButtonFor` 函数中可以修改按钮的显示文本和模式：
- `'iframe'`: 原始格式
- `'markdown'`: Markdown 模式
- `'json'`: JSON 模式

## 与主脚本的关系

此脚本原本是 `emoji-extension` 主脚本的一部分（`src/userscript/modules/rawPreview.ts`），现已分离为独立脚本：

- **优点**:
  - 按需安装，减少主脚本体积
  - 独立更新和维护
  - 不影响主脚本功能

- **注意**:
  - 安装主脚本后，预览按钮功能默认不包含
  - 需要单独安装此脚本才能使用预览功能

## 故障排除

### 预览按钮不显示

1. 检查是否在 Discourse 论坛页面
2. 查看控制台是否有错误
3. 确认脚本已启用

### 预览窗口加载失败

1. 检查网络连接
2. 确认话题 ID 正确
3. 查看控制台错误信息

### JSON 模式不工作

1. 确认论坛支持 JSON API
2. 检查是否有跨域限制
3. 尝试其他预览模式

## 更新日志

### v1.0.0
- 从主脚本分离为独立脚本
- 支持三种预览模式
- 完整的键盘导航
- 自动分页加载

## 许可证

MIT License - 与主项目保持一致

## 相关链接

- 主项目: https://github.com/stevessr/bug-v3
- 问题反馈: https://github.com/stevessr/bug-v3/issues
