# 关于对话框的说明

## 已替换的对话框

我们已经成功将以下JavaScript原生对话框替换为自定义样式：

### ✅ 已替换

1. **`window.alert()` → `customAlert()`**
   - 用于差分上传时的提示消息
   - 例如："所有选择的图片都已在 markdown 文本中存在，无需上传。"

2. **`window.confirm()` → `customConfirm()`**
   - 用于差分上传时的确认对话框
   - 例如："发现 5 个图片已存在，是否继续上传剩余 10 个图片？"

### ❌ 无法替换（浏览器原生UI）

以下对话框是**浏览器原生UI**，出于安全考虑，**无法自定义**：

1. **文件选择对话框**
   - 当点击"选择文件"按钮时
   - 使用 `<input type="file">` 触发
   - 浏览器会显示系统文件选择器

2. **文件夹选择对话框**
   - 当点击"选择文件夹"按钮时（文件夹上传模式）
   - 使用 `<input webkitdirectory>` 触发
   - 浏览器会显示系统文件夹选择器

3. **权限请求对话框**
   - 例如通知权限、剪贴板权限等
   - 浏览器安全机制，不允许自定义

## 为什么无法替换文件选择对话框？

### 安全原因

浏览器不允许网页自定义文件选择对话框，这是为了：

1. **防止钓鱼攻击**
   - 恶意网站可能伪造文件选择界面
   - 诱导用户上传敏感文件

2. **保护用户隐私**
   - 确保用户知道自己在选择文件
   - 防止网站偷偷访问文件系统

3. **统一用户体验**
   - 用户熟悉系统原生的文件选择器
   - 不同网站使用相同的界面

### 技术限制

```typescript
// 这会触发浏览器原生的文件选择对话框
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.webkitdirectory = true  // 文件夹模式
fileInput.click()  // ← 这里会打开系统原生对话框
```

当调用 `fileInput.click()` 时，浏览器会：
1. 暂停JavaScript执行
2. 显示系统原生文件选择器
3. 等待用户选择
4. 返回选择结果

整个过程由浏览器内核控制，网页无法干预。

## 各浏览器的文件选择器样式

### Windows
- Chrome/Edge: Windows 资源管理器样式
- Firefox: Windows 资源管理器样式

### macOS
- Chrome/Edge/Safari: macOS Finder 样式
- Firefox: macOS Finder 样式

### Linux
- Chrome/Firefox: GTK/Qt 文件选择器

## 我们做了什么

虽然无法替换文件选择对话框，但我们做了以下优化：

### ✅ 已优化的地方

1. **上传窗口**
   - ✅ 完全自定义样式
   - ✅ 可拖动
   - ✅ 无遮罩层
   - ✅ 支持拖拽上传

2. **上传队列窗口**
   - ✅ 自定义样式
   - ✅ 可拖动
   - ✅ 实时进度显示
   - ✅ 限流智能处理

3. **确认对话框**
   - ✅ 自定义样式（仅在差分上传时）
   - ✅ 平滑动画
   - ✅ 主题适配

4. **提示对话框**
   - ✅ 自定义样式（仅在差分上传时）
   - ✅ 键盘支持
   - ✅ 点击遮罩关闭

## 文件夹上传流程说明

### 用户操作流程

1. 点击 **📷 上传图片** 按钮
   - ✅ 显示自定义上传窗口

2. 切换到 **文件夹上传** 标签
   - ✅ 在自定义窗口内切换

3. 点击上传区域或"选择文件夹"
   - ❌ **浏览器原生文件夹选择器**（无法自定义）
   - 这是正常的，所有网站都是这样

4. 选择文件夹后
   - ✅ 返回自定义窗口
   - ✅ 显示自定义上传队列

### 可能的混淆

用户可能认为的"原生弹窗"是指：

1. **文件夹选择器** ← 这是浏览器原生UI，无法更改
2. **JavaScript alert/confirm** ← 这个我们已经替换了

## 对比图

### 旧版本（全部原生）

```
点击上传 → 原生alert → 原生文件选择器 → 原生alert确认
    ❌          ❌              ❌                ❌
```

### 新版本（混合）

```
点击上传 → 自定义窗口 → 原生文件选择器 → 自定义队列窗口
    ✅          ✅              ❌                ✅
               └─ 如有确认 → 自定义confirm
                              ✅
```

## 总结

✅ **已替换**：所有JavaScript alert/confirm/prompt
❌ **无法替换**：文件/文件夹选择器（浏览器安全限制）

如果用户看到的是"文件夹选择对话框"，那是正常的，所有网站（包括Google Drive、Dropbox等）都使用浏览器原生的文件选择器。

## 参考资料

- [HTML5 File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
- [Input Element (file type)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file)
- [Browser Security Model](https://developer.mozilla.org/en-US/docs/Web/Security)
