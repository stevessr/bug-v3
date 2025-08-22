# HTML输出格式功能添加报告

## 概述
成功为表情扩展添加了HTML输出格式选项，用户现在可以在选项页面中选择使用Markdown格式（默认）或HTML格式插入表情。

## 实现的功能

### 1. 新增设置选项
- 在`AppSettings`接口中添加了`outputFormat: 'markdown' | 'html'`字段
- 默认值设置为`'markdown'`，保持向后兼容性

### 2. HTML输出格式
当用户选择HTML格式时，插入的表情将使用以下格式：
```html
<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${pixelWidth}" height="${pixelHeight}" style="aspect-ratio: ${pixelWidth} / ${pixelHeight};">
```

这与您提供的示例格式一致：
```html
<img src="/images/emoji/twemoji/rofl.png?v=14" title=":rofl:" class="emoji only-emoji" alt=":rofl:" loading="lazy" width="20" height="20" style="aspect-ratio: 20 / 20;">
```

### 3. 用户界面
在选项页面的"设置"标签中添加了输出格式选择器，用户可以在以下两种格式之间切换：
- **Markdown 格式**（默认）：`![表情名|宽x高,缩放%](URL)`
- **HTML 格式**：标准的HTML img标签格式

## 修改的文件

### 核心逻辑文件
1. **`src/types/emoji.ts`**
   - 在`AppSettings`接口中添加`outputFormat`字段
   - 更新`defaultSettings`包含默认的输出格式

2. **`src/content/state.ts`**
   - 更新本地的`AppSettings`接口
   - 在`cachedState`中添加默认输出格式

3. **`src/content/editor.ts`**
   - 修改`insertEmojiIntoEditor`函数，根据用户设置的输出格式生成相应的文本
   - 添加对HTML格式的支持，包括正确的尺寸计算和样式设置

### 用户界面文件
4. **`src/options/components/GlobalSettings.vue`**
   - 添加输出格式选择器UI组件
   - 更新emits定义以支持新的事件

5. **`src/options/useOptions.ts`**
   - 添加`updateOutputFormat`函数处理用户选择
   - 在返回值中导出新函数

6. **`src/options/Options.vue`**
   - 连接新的事件处理器
   - 导出`updateOutputFormat`函数供模板使用

### 调试和测试文件
7. **`debug-storage.html`**
   - 更新默认设置以包含输出格式选项

8. **`test-html-output.html`**（新创建）
   - 创建了专门的测试页面验证HTML输出格式功能

## 特性详情

### 尺寸处理
- HTML格式输出会根据用户设置的缩放比例自动计算像素尺寸
- 使用`aspect-ratio` CSS属性确保表情比例正确
- 包含`loading="lazy"`属性优化页面加载性能

### 向后兼容性
- 默认保持Markdown格式，不影响现有用户体验
- 新用户可以根据需要选择合适的输出格式

### 用户体验
- 在选项页面提供直观的格式选择器
- 设置会自动保存并同步到所有表情插入操作

## 测试
- 创建了独立的测试页面验证功能正常工作
- 确保在不同格式之间切换时表情插入行为正确
- 验证了尺寸计算和CSS样式的正确性

## 构建结果
项目成功构建，所有TypeScript类型检查通过，没有编译错误或警告。

## 使用方法
1. 打开扩展选项页面
2. 在"设置"标签中找到"输出格式"选择器
3. 选择"HTML 格式"或"Markdown 格式"
4. 设置会自动保存，之后插入的表情将使用选定的格式
