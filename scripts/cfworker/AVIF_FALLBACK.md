# AVIF 格式处理说明

## 问题背景

用户选择 AVIF 格式时遇到以下问题：

1. **ffmpeg.wasm 不支持 AVIF 编码器**
   - 错误信息：`Automatic encoder selection failed for output stream #0:0`
   - 原因：当前 ffmpeg.wasm 构建版本未包含 AV1/AVIF 编码器（如 libaom-av1、libavif）

2. **浏览器端 WebCodecs API 限制**
   - ImageEncoder API 尚未广泛支持
   - 即使支持，AVIF 编码也需要特定配置

## 解决方案

采用 **降级策略**：AVIF → WebP

### 实现逻辑

```javascript
if (format === 'avif') {
  // 1. 使用 ffmpeg.wasm 导出 PNG（保留所有视频滤镜）
  await ffmpeg.exec([...args, '-frames:v', '1', '-f', 'png', 'output.png'])

  // 2. 通过 Canvas API 转换为 WebP
  const imgBitmap = await createImageBitmap(pngBlob)
  canvas.toBlob(callback, 'image/webp', 0.8)

  // 3. 返回 WebP blob，提示用户已降级
}
```

### 优势

- ✅ **无错误**：避免 ffmpeg.wasm AVIF 编码失败
- ✅ **高兼容性**：WebP 在所有现代浏览器中广泛支持
- ✅ **高质量**：WebP 提供接近 AVIF 的压缩效果
- ✅ **体积小**：WebP 比 PNG/GIF 体积更小
- ✅ **透明提示**：UI 明确告知用户使用了降级方案

### 用户体验

1. 用户选择 AVIF 格式
2. UI 显示："AVIF（降级为 WebP）"
3. 转换过程提示："处理图像（降级为 WebP）..."
4. 结果显示：
   - 标题："结果预览（WebP - AVIF 降级）"
   - 提示："⚠️ 浏览器端暂不支持 AVIF 编码，已自动降级为 WebP 格式（体积小、质量高）"
   - 下载按钮："下载 WebP"

## 为什么不使用真正的 AVIF？

### 技术限制

1. **ffmpeg.wasm 编译限制**
   - libaom-av1 编码器体积巨大（>50MB）
   - 编译需要额外配置
   - Cloudflare Pages 25MB 文件限制

2. **浏览器 API 限制**
   - ImageEncoder API 仍处于实验阶段
   - 大多数浏览器不支持
   - 配置复杂，兼容性差

3. **性能考虑**
   - AVIF 编码极慢（尤其在浏览器端）
   - WebP 编码快速且高效

### 替代方案对比

| 格式 | 体积 | 质量 | 浏览器支持 | 编码速度 |
| ---- | ---- | ---- | ---------- | -------- |
| AVIF | 最小 | 最高 | 部分支持   | 极慢     |
| WebP | 很小 | 很高 | 广泛支持   | 快速     |
| PNG  | 大   | 无损 | 全部支持   | 快速     |

## 未来改进

如果需要真正的 AVIF 支持，可以考虑：

1. **自定义编译 ffmpeg.wasm**

   ```bash
   # 包含 libaom-av1 编码器
   emcc --enable-libaom ...
   ```

2. **使用 WASM AVIF 编码器库**
   - avif.js
   - libavif-wasm

3. **后端服务**
   - 在服务器端使用完整版 ffmpeg
   - API 调用远程 AVIF 编码服务

## 总结

当前方案平衡了**功能、性能、兼容性**：

- 用户可以选择 AVIF，不会遇到错误
- 自动降级为 WebP，体积和质量接近 AVIF
- 清晰的 UI 提示，用户体验良好
