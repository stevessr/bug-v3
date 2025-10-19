# WebCodecs AVIF 编码功能

## 功能概述

新增了使用 WebCodecs ImageEncoder API 编码真正 AVIF 格式的实验性功能。

## 使用方法

1. 选择视频文件
2. 在"输出格式"中选择 **AVIF**
3. 勾选 **"使用 WebCodecs 编码真正的 AVIF"** 复选框
4. 点击"开始转换"

## 功能说明

### 两种模式

#### 1. WebCodecs 模式（勾选复选框）
- ✅ **真正的 AVIF 格式**：使用浏览器原生 WebCodecs ImageEncoder API
- 🎯 **高压缩率**：AVIF 比 WebP 体积更小（通常减少 20-50%）
- 🎨 **高质量**：支持 HDR、广色域
- ⚠️ **浏览器要求**：需要最新版 Chrome/Edge（90+），Firefox 不支持

#### 2. Canvas 降级模式（不勾选复选框，默认）
- 🔄 **自动降级为 WebP**：通用兼容方案
- ✅ **广泛兼容**：所有现代浏览器都支持
- 💾 **体积较小**：比 PNG 小 70-90%
- 📱 **移动友好**：移动浏览器完美支持

## 浏览器兼容性

| 浏览器 | ImageEncoder API | Canvas WebP |
|--------|-----------------|-------------|
| Chrome 90+ | ✅ 支持 | ✅ 支持 |
| Edge 90+ | ✅ 支持 | ✅ 支持 |
| Firefox | ❌ 不支持 | ✅ 支持 |
| Safari | ❌ 不支持 | ✅ 支持 |

## 技术细节

### 编码流程

```
选择视频 → FFmpeg 导出 PNG → 两种方案：
                                ├─ WebCodecs ImageEncoder → AVIF
                                └─ Canvas toBlob → WebP（降级）
```

### 代码实现

```javascript
// 检查是否启用 WebCodecs
const useWebCodecs = document.getElementById('useWebCodecs').checked;

// 尝试使用真正的 WebCodecs API
if (useWebCodecs && 'ImageEncoder' in window) {
  const encoder = new ImageEncoder({
    mimeType: 'image/avif',
    width: imgBitmap.width,
    height: imgBitmap.height,
    quality: 0.8
  });
  
  await encoder.encode(imgBitmap);
  const result = await encoder.flush();
  return new Blob([result], { type: 'image/avif' });
}

// 降级方案：Canvas WebP
canvas.toBlob(blob => resolve(blob), 'image/webp', 0.8);
```

## 错误处理

- 如果勾选了 WebCodecs 但浏览器不支持 → 自动降级为 Canvas WebP
- 如果 ImageEncoder 初始化失败 → 显示错误并降级
- 日志中会清楚标识使用的编码方案

## 建议

### 何时使用 WebCodecs AVIF？
- ✅ 使用最新版 Chrome/Edge 浏览器
- ✅ 需要极致的文件体积压缩
- ✅ 目标用户也使用现代浏览器

### 何时使用 Canvas WebP？
- ✅ 需要广泛的浏览器兼容性
- ✅ 移动设备用户
- ✅ 不确定用户浏览器版本

## 未来改进

1. **自动检测**：自动检测浏览器是否支持 ImageEncoder，隐藏/禁用复选框
2. **质量调节**：增加质量滑块（目前固定 0.8）
3. **多帧支持**：尝试编码动画 AVIF（需要序列化多帧）
4. **进度显示**：显示编码进度条
5. **Polyfill**：引入 WASM AVIF 编码器作为备用方案

## 参考资料

- [WebCodecs API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [ImageEncoder Proposal](https://github.com/w3c/webcodecs/blob/main/image_encoder_spec.md)
- [AVIF 格式介绍](https://jakearchibald.com/2020/avif-has-landed/)

## 更新日志

- **2025-10-19**: 初始实现，添加 WebCodecs 复选框和真正的 AVIF 编码支持
