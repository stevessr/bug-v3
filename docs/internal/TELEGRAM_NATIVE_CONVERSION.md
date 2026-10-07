# Telegram 视频贴纸本地转换

Telegram 导入页和缓冲区导入弹窗共用 `telegramNativeWebmFormat` 设置。

- 默认 `webp`：HTMLVideoElement 解码 WebM，Canvas 原生编码 WebP 帧，然后按 WebP RIFF 规范封装动画。无需 FFmpeg/WASM 或转换服务器，20fps、最大 512px、最长 10 秒，循环播放。
- `avif`：只输出静态首帧。先尝试 Canvas 原生 AVIF 编码并检查实际 MIME；浏览器不支持时动态加载本地 jsquash AVIF WASM 编码。不会把 Canvas 静默返回的 PNG 伪装为 AVIF。
- `animated-avif`：浏览器原生解码 WebM、随扩展打包的 jsquash AVIF WASM 编码每帧，浏览器 Worker 中的 FFmpeg WASM 仅封装动画容器（不依赖其 AV1 编码器），无需安装 FFmpeg、本机进程或转换服务。失败时报告错误，不静默降级静态。目前只封装颜色轨道，透明源会明确提示透明通道丢失；需透明背景时选择动画 WebP。
- `disabled`：保留此前的离线动画 AVIF / 后端转换行为。

前三种浏览器模式绝不请求转换后端；失败时报告错误。旧版模式才使用已配置的兜底。TGS 仍使用已有的浏览器内 WASM AVIF 路径，不受 WebM 格式设置控制。输出格式和动画降级在导入进度/提示中展示。转换在本地完成，但从 Telegram 下载以及之后上传到所选图床仍需要网络。透明通道以浏览器对源 WebM 的解码结果为准。

从分组菜单发起的更新，在保存分组和结束批处理之后返回 `/groups`；取消、获取失败或转换失败不自动跳转。手动导入和批量队列仍留在导入页。

验证（使用 pnpm）：

```sh
pnpm build
pnpm exec playwright test --config scripts/tests/telegram-native-conversion.config.ts
```

回归使用本地生成的 32×32 红/蓝 WebM、模拟 Telegram API 和本地存储，不访问真实 Telegram / 图床。涵盖动画颜色/时长、格式检查、取消和 URL 回收、真实静态/动画 AVIF 解码、动画 AVIF 帧数/颜色/时长以及不请求外部转换服务、更新成功/失败跳转。实际浏览器扩展权限与真实服务上传仍需另外验收。
