# 设置转换和重置功能

本项目新增了旧设置格式转换和前端重置设置的功能。

## 转换脚本

### 功能

- 将旧的 `public/static/config/default.json` 转换为新的持久化 payload 格式
- 为所有表情组和表情生成真实的 UUID
- 建立旧 ID 到新 UUID 的映射关系
- 正确映射 `defaultGroup` 字段到 `defaultEmojiGroupUUID`

### 使用方法

```bash
# 在项目根目录运行
node scripts/convert-old-settings.cjs
```

### 输出

- 生成 `public/static/config/converted_payload.json`
- 在终端显示 ID 到 UUID 的映射关系
- 显示转换预览

## 前端重置功能

### 新增按钮（在设置页面）

1. **重置设置** - 仅重置设置项，保留表情组数据
2. **应用默认（不刷新分组）** - 应用默认设置但不改变分组
3. **完全重置（包括分组）** - 重置所有数据，包括表情组

### 特性

- 使用转换后的 `converted_payload.json` 作为默认值源
- 自动回退到内置默认值（如果转换文件不可用）
- 提供确认对话框防止误操作
- 完全重置后会自动刷新页面

### 工作流程

1. 运行转换脚本生成 `converted_payload.json`
2. 在设置页面使用重置按钮
3. 系统自动从转换文件加载默认值
4. 更新设置并广播到其他页面

## 转换映射

| 旧字段                     | 新字段                              | 说明                     |
| -------------------------- | ----------------------------------- | ------------------------ |
| `settings.imageScale`      | `Settings.imageScale`               | 图片缩放比例             |
| `settings.defaultGroup`    | `Settings.defaultEmojiGroupUUID`    | 默认表情组（映射为UUID） |
| `settings.gridColumns`     | `Settings.gridColumns`              | 网格列数                 |
| `settings.outputFormat`    | `Settings.outputFormat`             | 输出格式                 |
| `settings.forceMobileMode` | `Settings.MobileMode`               | 移动端模式               |
| `groups[].id`              | `emojiGroups[].UUID`                | 表情组ID转为UUID         |
| `groups[].emojis[].id`     | `emojiGroups[].emojis[].UUID`       | 表情ID转为UUID           |
| `groups[].emojis[].url`    | `emojiGroups[].emojis[].realUrl`    | 真实图片URL              |
| `groups[].emojis[].url`    | `emojiGroups[].emojis[].displayUrl` | 显示图片URL              |

## 注意事项

- 转换脚本会为每次运行生成新的UUID
- 如需固定UUID，可修改脚本使用种子生成
- 完全重置功能会删除所有自定义数据，请谨慎使用
- 转换后的文件包含 `_metadata` 字段用于调试和追踪
- URL映射：原有的 `url` 字段会同时映射到 `realUrl` 和 `displayUrl`，保持向后兼容性
- `realUrl` 用于实际图片获取，`displayUrl` 用于界面显示（通常相同，但可以针对不同场景优化）
