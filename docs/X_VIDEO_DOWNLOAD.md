# X / Twitter MP4 直接下载

在 X（x.com、twitter.com）的视频播放区域或 GIF / 视频封面右上角显示下载和复制 MP4 直链按钮。支持时间线、推文详情及动态新增的播放器。

## 解析方式

- 在点击时读取所属推文时间戳链接的 ID（避免 X 复用 DOM 导致链接失效），按同条推文的视频出现顺序选择视频。
- 扩展后台请求 X 官方公开的 cdn.syndication.twimg.com/tweet-result，读取视频 / animated_gif 的 video_info.variants，选择码率最高的 video/mp4，忽略 m3u8、HLS 单轨及 blob: 播放地址。
- 使用 Chrome Downloads API 下载，复制按钮复制真正的 MP4 地址；不会先将整个视频拉进内容脚本的内存，也不需要外部解析站、第三方代理、额外 Cookie 权限或密钥。
- 公开推文解析失败时，如果当前 video 有可信 video.twimg.com 的 MP4 直链则回退。受保护推文、只提供 DRM/HLS 且无法找到 MP4 的内容可能无法下载，不尝试绕过访问限制。
- 解析请求只在用户点击时发生，后台校验请求来源、推文 ID 和返回的 MP4 域名。

## 手动验证清单

1. pnpm build，安装 dist/ 作为未打包扩展，刷新 x.com。
2. 在普通视频、动图（X GIF 实际为 MP4）、未开始播放的封面上检查两个按钮是否出现。
3. 在时间线滚动、进入推文详情、打开媒体弹层后检查按钮，确保每个播放器仅出现一组。
4. 在多个视频的推文中分别下载，并检查文件可正常播放、有声音（原视频含音轨时）且不是 m3u8 或 blob 文件。
5. 点击复制，检查剪贴板为 https://video.twimg.com/...mp4。
6. 查看失败的公开接口请求、私密推文的错误提示，确保不会把错误页面误存成 .mp4。
7. 检查原图片按钮、自动下载图片功能没有回归。

解析单元测试：pnpm exec playwright test scripts/tests/x-video-media.spec.ts（需要先构建，以供 Playwright webServer 使用）。
