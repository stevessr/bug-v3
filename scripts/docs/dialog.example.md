# 自定义对话框使用示例

## 简介

我们实现了三个自定义对话框函数来替代原生的 `window.alert`、`window.confirm` 和 `window.prompt`。这些对话框具有更好的样式，支持主题变量，并且提供了更好的用户体验。

## API

### customAlert

显示一个信息提示框，只有一个"确定"按钮。

```typescript
import { customAlert } from './dialog'

// 基本使用
await customAlert('操作成功！')

// 使用 await 等待用户确认
await customAlert('请注意：这是一个重要提示')
console.log('用户已确认')
```

**特性：**

- ✅ 支持 ESC 键关闭
- ✅ 支持点击背景关闭
- ✅ 自动聚焦"确定"按钮
- ✅ 平滑动画效果
- ✅ 响应式设计

### customConfirm

显示一个确认对话框，包含"取消"和"确定"按钮。

```typescript
import { customConfirm } from './dialog'

// 基本使用
const result = await customConfirm('确定要删除这个项目吗？')
if (result) {
  console.log('用户点击了确定')
} else {
  console.log('用户点击了取消')
}

// 实际应用
const proceed = await customConfirm('发现 5 个图片已存在，是否继续上传剩余 10 个图片？')
if (proceed) {
  // 执行上传操作
}
```

**特性：**

- ✅ 返回 `true` (确定) 或 `false` (取消)
- ✅ 支持 ESC 键取消
- ✅ 支持点击背景取消
- ✅ 自动聚焦"确定"按钮
- ✅ 双按钮布局

### customPrompt

显示一个输入对话框，让用户输入文本。

```typescript
import { customPrompt } from './dialog'

// 基本使用
const name = await customPrompt('请输入您的名字：')
if (name !== null) {
  console.log('用户输入了：', name)
} else {
  console.log('用户取消了输入')
}

// 带默认值
const url = await customPrompt('请输入网址：', 'https://example.com')
if (url) {
  // 使用输入的 URL
}
```

**特性：**

- ✅ 返回输入的字符串，或 `null` (取消)
- ✅ 支持默认值
- ✅ 支持 Enter 键确认
- ✅ 支持 ESC 键取消
- ✅ 自动聚焦输入框并选中文本
- ✅ 输入框焦点样式

## 样式特性

所有对话框都支持以下特性：

1. **主题支持**
   - 使用 CSS 变量 (如 `var(--primary-very-low)`) 适配网站主题
   - 自动适配深色/浅色模式

2. **动画效果**
   - 淡入淡出背景遮罩
   - 对话框缩放动画
   - 流畅的过渡效果

3. **响应式设计**
   - 最小宽度 300px
   - 最大宽度 500px
   - 最大宽度为屏幕 90%
   - 自动换行长文本

4. **无障碍特性**
   - 键盘导航支持
   - 自动焦点管理
   - 语义化 HTML

## 在项目中的使用

### 已替换的原生对话框

在 `uploader.ts` 中：

1. **替换 alert**

   ```typescript
   // 之前
   alert('所有选择的图片都已在 markdown 文本中存在，无需上传。')

   // 现在
   await customAlert('所有选择的图片都已在 markdown 文本中存在，无需上传。')
   ```

2. **替换 confirm**

   ```typescript
   // 之前
   const proceed = confirm('发现 5 个图片已存在，是否继续上传？')

   // 现在
   const proceed = await customConfirm('发现 5 个图片已存在，是否继续上传？')
   ```

### 导出方式

通过 `src/content/utils/index.ts` 统一导出：

```typescript
export { customAlert, customConfirm, customPrompt } from './dialog'
```

使用时可以这样导入：

```typescript
import { customAlert, customConfirm, customPrompt } from '@/content/utils'
```

## 技术实现

### 核心技术

1. **Promise 异步**
   - 所有函数返回 Promise
   - 支持 async/await 语法
   - 用户操作后 resolve Promise

2. **DOM 操作**
   - 使用 `createE` 工具函数创建元素
   - 动态添加到 `document.body`
   - 操作完成后自动清理

3. **事件处理**
   - 监听键盘事件 (Enter, Escape)
   - 监听鼠标点击事件
   - 自动清理事件监听器

4. **动画处理**
   - CSS @keyframes 动画
   - 延迟 resolve 以等待动画完成
   - 平滑的进入和退出效果

## 与原生对话框的对比

| 特性       | 原生对话框    | 自定义对话框    |
| ---------- | ------------- | --------------- |
| 样式自定义 | ❌ 无法自定义 | ✅ 完全自定义   |
| 主题适配   | ❌ 系统风格   | ✅ 网站主题     |
| 动画效果   | ❌ 无动画     | ✅ 平滑动画     |
| 异步支持   | ❌ 同步阻塞   | ✅ Promise 异步 |
| 键盘支持   | ✅ 基本支持   | ✅ 完整支持     |
| 移动端友好 | ⚠️ 一般       | ✅ 响应式       |
| 浏览器兼容 | ✅ 全兼容     | ✅ 现代浏览器   |

## 未来改进

可能的改进方向：

1. 添加图标支持 (成功/警告/错误图标)
2. 支持 HTML 内容而非纯文本
3. 添加更多动画效果选项
4. 支持自定义按钮文本
5. 支持多按钮选项
6. 添加对话框位置配置
7. 支持对话框大小配置
