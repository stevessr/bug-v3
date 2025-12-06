# 自动下载功能

## 功能概述

为 X.com 图片添加自动下载功能。当检测到匹配特定后缀的图片 URL 时，系统会自动触发下载。

## 主要特性

1. **URL 后缀匹配**：可配置多个 URL 后缀进行监控（如 `name=large`、`name=orig`）
2. **防重复下载**：维护已下载 URL 列表，避免重复下载同一图片
3. **自动文件命名**：从 URL 提取文件名，或根据参数生成合理的文件名
4. **智能下载策略**：优先使用 fetch + blob 下载，失败时降级为打开新标签页

## 使用方法

### 1. 启用功能

在扩展的 Options 页面：
1. 进入「设置」→「自动下载」标签页
2. 开启「启用自动下载」开关

### 2. 配置监控后缀

默认监控以下后缀：
- `name=large` - 大图
- `name=orig` - 原图

你可以添加或删除自定义后缀，例如：
- `name=4096x4096` - 4K 图
- `format=jpg&name=large` - 大图 JPG
- 任何包含在 URL 中的字符串

### 3. 工作原理

当你在 X.com 浏览时：
1. 系统扫描页面中的图片
2. 检查图片 URL 是否包含配置的后缀
3. 如果匹配且未下载过，自动触发下载
4. 记录 URL 到已下载列表，避免重复

## 技术实现

### 核心模块

1. **autoDownloadManager.ts** - 自动下载管理器
   - 维护已下载 URL 集合
   - 提供 URL 匹配检测
   - 处理实际下载逻辑

2. **carousel.ts** - 图片注入集成
   - 在检测到图片时调用自动下载检测
   - 与现有按钮注入功能协同工作

3. **xImages.ts** - 配置初始化
   - 从 Chrome Storage 加载配置
   - 监听配置变化并实时更新

4. **AutoDownloadSettings.vue** - UI 设置组件
   - 提供开关控制
   - 管理后缀列表
   - 实时保存到 storage

### 配置存储

配置保存在 `chrome.storage.local` 的 `settings` 对象中：
```typescript
{
  enableAutoDownload: boolean
  autoDownloadSuffixes: string[]
}
```

## 注意事项

1. **仅支持 X.com**：当前功能仅在 X.com (twitter.com) 上生效
2. **跨域限制**：如遇 CORS 限制，会降级为打开新标签页
3. **浏览器兼容**：需要支持 Blob 和 URL.createObjectURL 的现代浏览器
4. **性能考虑**：批量下载时有 100ms 间隔以避免过载

## 文件变更

### 新增文件
- `src/utils/autoDownloadManager.ts` - 自动下载管理器
- `src/options/components/AutoDownloadSettings.vue` - 设置 UI 组件

### 修改文件
- `src/types/type.ts` - 添加配置类型定义
- `src/types/defaultSettings.ts` - 添加默认配置
- `src/content/x/image/carousel.ts` - 集成自动下载检测
- `src/content/x/xImages.ts` - 初始化配置加载
- `src/options/useOptions.ts` - 添加更新函数
- `src/options/pages/SettingsPage.vue` - 添加设置标签页

## 未来改进

- [ ] 支持更多网站（如 Pixiv、Instagram）
- [ ] 添加下载历史查看功能
- [ ] 支持按文件大小过滤
- [ ] 添加下载统计面板
- [ ] 支持自定义下载目录
