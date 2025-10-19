# 视频转 GIF 功能独立部署说明

## 重要变更

**视频转 GIF 功能已从浏览器扩展中完全移除，现作为独立的 Web 应用提供。**

用户无需安装扩展即可使用该功能，直接访问部署的 Web 应用即可。

## 为什么独立？

### 原扩展方案的问题
- Chrome Manifest V3 的 CSP 限制无法加载远程 CDN 的 ffmpeg.wasm
- 本地打包 wasm 会导致扩展体积过大（~30MB）
- 首次加载慢，占用浏览器内存高
- 复杂视频处理受浏览器性能限制

### 独立 Web 应用的优势
- ✅ 无需安装扩展，任何人都可使用
- ✅ 服务器端转码，速度更快
- ✅ 无 CSP 限制，部署简单
- ✅ 支持更大的视频文件
- ✅ 可独立更新维护

## 快速开始

### 部署服务（推荐 Vercel）

```bash
cd scripts/cfworker
npm install
npx vercel
```

部署完成后会得到一个 URL，例如：`https://video2gif.vercel.app`

### 使用服务

直接访问部署的 URL，即可看到完整的 Web UI：

1. 上传 MP4 文件或填写视频 URL
2. 设置参数（FPS、宽度等）
3. 点击"开始转换"
4. 下载生成的 GIF

## 项目位置

所有相关代码已迁移到 `scripts/cfworker/` 目录：

```
scripts/cfworker/
├── public/index.html    # 完整的前端 UI
├── server.js            # Express 后端 API
├── package.json         # 依赖配置
├── vercel.json          # Vercel 部署配置
└── README.md            # 详细说明
```

## 支持的部署平台

| 平台 | 推荐度 | 免费额度 | 部署难度 | 备注 |
|------|--------|----------|----------|------|
| Vercel | ⭐⭐⭐⭐⭐ | 100GB/月 | 极简 | 一键部署 |
| Railway | ⭐⭐⭐⭐ | $5/月 | 简单 | 支持大文件 |
| Render | ⭐⭐⭐ | 750h/月 | 中等 | 免费但慢 |
| 自建 VPS | ⭐⭐ | 无限制 | 复杂 | 需运维 |

详细部署指南请查看 [`scripts/cfworker/README.md`](../scripts/cfworker/README.md)

## 扩展变更记录

- ❌ 删除 `src/options/pages/VideoToGifPage.vue`
- ❌ 删除选项页中的"视频转 GIF"菜单项
- ❌ 移除 `@ffmpeg/ffmpeg` 和 `@ffmpeg/util` 依赖
- ✅ 功能完整迁移到 `scripts/cfworker/`

## 常见问题

### Q: 为什么不保留在扩展中？
A: Manifest V3 的严格 CSP 限制导致无法加载 ffmpeg.wasm，且本地打包体积过大。独立部署可以避免这些问题。

### Q: 是否需要付费？
A: Vercel/Railway 等平台提供免费额度，足够个人使用。超出可按需付费或自建。

### Q: 数据安全吗？
A: 服务器端转码后立即删除临时文件，不存储用户数据。建议自行部署以确保隐私。

### Q: 能否集成回扩展？
A: 可以，但需用户自行部署后端并在扩展中配置 API 端点（此方案已废弃，改为完全独立）。
