# Discourse Callout 建议 (Callout Suggestions)

这是一个独立的 Tampermonkey/Greasemonkey 用户脚本，为 Discourse 论坛添加 Markdown Callout 自动建议功能。

## 功能特性

### 🎯 主要功能

- **自动建议**: 输入 `[` 字符时自动显示 callout 关键词建议
- **丰富的 Callout 类型**: 支持 30+ 种内置 callout 类型
  - note, abstract, summary, tldr
  - info, todo, tip, hint
  - success, check, done
  - question, help, faq
  - warning, caution, attention
  - failure, fail, missing
  - danger, error, bug
  - example, quote, cite
- **视觉化图标**: 每种 callout 类型都有独特的图标和配色
- **键盘导航**:
  - 上下箭头键：选择建议项
  - Tab/Enter：应用选中的建议
  - ESC：关闭建议框
- **智能定位**: 建议框自动定位在光标位置，支持上下翻转避免遮挡

### 🔧 编辑器支持

- **Textarea 编辑器**: 完整支持
- **ProseMirror 编辑器**: 完整支持（Discourse 新版编辑器）
- **自动检测**: 脚本会自动检测编辑器类型并应用相应逻辑

### ⚙️ 设置集成

- **全局设置**: 读取 `emoji_extension_settings` 中的配置
- **强制移动模式**: 遵从全局 `forceMobileMode` 设置
- **独立运行**: 不依赖主表情脚本，可单独安装使用

## 安装方法

### 前提条件

1. 安装油猴脚本管理器：
   - Chrome/Edge: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Safari: [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### 安装脚本

方法 1: 从 GitHub Release 安装

```
https://github.com/stevessr/bug-v3/releases/latest/download/callout-suggestions.user.js
```

方法 2: 手动安装

1. 打开 `scripts/callout-suggestions.user.js` 文件
2. 复制全部内容
3. 在 Tampermonkey 管理面板创建新脚本
4. 粘贴内容并保存

## 使用方法

1. 访问任意 Discourse 论坛（如 linux.do）
2. 在编辑器中输入 `[`
3. 建议框会自动弹出显示可用的 callout 类型
4. 使用以下方式选择：
   - **鼠标**: 点击任意建议项
   - **键盘**: 方向键选择 + Tab/Enter 确认
5. 脚本会自动插入 `[!keyword]` 格式

### 示例

输入 `[w` 会显示匹配的建议：

- warning
- (其他以 w 开头的 callout)

选择 "warning" 后，会在编辑器中插入：

```
[!warning]
```

## 支持的网站

- linux.do
- meta.discourse.org
- 所有基于 Discourse 的论坛网站
- localhost:5173（开发环境）
- idcflare.com

## Callout 类型说明

### 信息类

- **note** 📝: 笔记/备注
- **info** ℹ️: 一般信息
- **abstract/summary/tldr** 📋: 摘要

### 提示类

- **tip/hint** 💡: 提示/技巧
- **todo** ☑️: 待办事项

### 问题类

- **question/help/faq** ❓: 问题/帮助

### 成功类

- **success/check/done** 🎉: 成功/完成

### 警告类

- **warning/caution/attention** ⚠️: 警告/注意

### 错误类

- **failure/fail/missing** ❌: 失败
- **danger/error** ☠️: 危险/错误
- **bug** 🐛: 程序错误

### 其他

- **example** 🔎: 示例
- **quote/cite** 💬: 引用

## 技术实现

### 核心功能

- **触发检测**: 监听输入事件，检测 `[` 字符
- **关键词匹配**: 实时过滤匹配的 callout 类型
- **光标定位**: 计算光标位置并智能放置建议框
- **内容插入**: 支持 textarea 和 ProseMirror 的内容操作
- **事件处理**: 完整的键盘和鼠标事件支持

### 设置管理

脚本读取共享的 localStorage 设置：

```javascript
// 读取设置
const SETTINGS_KEY = 'emoji_extension_settings'
const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY))

// 检查强制移动模式
if (settings.forceMobileMode === true) {
  // 遵从全局设置
}
```

### 样式注入

- CSS 变量支持，自动适配 Discourse 主题
- 响应式设计，适配不同屏幕尺寸
- 深色/浅色主题自动适配

## 与主脚本的关系

此脚本原本是 `emoji-extension` 核心脚本的一部分，现已分离为独立脚本：

### 优点

- **按需安装**: 不需要此功能的用户无需安装
- **独立更新**: 功能可以独立更新维护
- **减小体积**: 核心脚本减小约 12KB

### 注意事项

- 安装核心脚本后，Callout 建议功能不再包含
- 需要单独安装此脚本才能使用自动建议
- 两个脚本共享 localStorage 设置

## 故障排除

### 建议框不显示

1. 检查是否在 Discourse 论坛页面
2. 确认在编辑器中输入 `[` 字符
3. 查看控制台是否有错误
4. 确认脚本已启用

### 无法插入 Callout

1. 检查编辑器是否获得焦点
2. 尝试刷新页面
3. 查看控制台错误信息

### 快捷键不工作

1. 确认建议框已显示
2. 检查是否有其他脚本冲突
3. 尝试禁用其他脚本

## 更新日志

### v1.0.0

- 从主脚本分离为独立脚本
- 支持 30+ callout 类型
- 完整的键盘导航
- 自动适配主题
- 遵从全局强制移动模式设置

## 许可证

MIT License - 与主项目保持一致

## 相关链接

- 主项目: https://github.com/stevessr/bug-v3
- 问题反馈: https://github.com/stevessr/bug-v3/issues
