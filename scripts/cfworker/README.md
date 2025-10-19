# Video to GIF - 视频转 GIF 纯静态应用

**完全在浏览器中运行的视频转 GIF 工具，无需后端服务**

使用 ffmpeg.wasm 在浏览器中直接转码，可部署到 Cloudflare Pages、GitHub Pages、Vercel 等任意静态托管平台。

## ✨ 特性

- ✅ 纯前端，完全在浏览器中运行
- ✅ 无需后端服务器或 API
- ✅ 数据不上传，完全本地处理
- ✅ 支持文件上传和 URL 下载
- ✅ 自定义参数：FPS、宽度、高度、时间段
- ✅ 实时日志显示
- ✅ 响应式设计

## 🚀 快速部署

### 方案一：Cloudflare Pages（推荐）

```bash
cd scripts/cfworker
npm install -g wrangler
npx wrangler pages deploy public
```

### 方案二：GitHub Pages

1. 将 `public/` 目录内容推送到 GitHub 仓库的 `gh-pages` 分支
2. 在仓库设置中启用 GitHub Pages

### 方案三：本地预览

```bash
cd scripts/cfworker
npm install
npm run dev
```

访问 `http://localhost:8788`

## 📁 项目结构

```
scripts/cfworker/
├── public/
│   ├── index.html           # 完整的单页应用
│   └── assets/
│       └── ffmpeg/          # FFmpeg 核心文件（小文件本地化）
│           ├── ffmpeg-core.js      # 核心 JS（112KB）
│           ├── worker.js           # Web Worker（5KB）
│           ├── const.js            # 常量定义（1KB）
│           └── errors.js           # 错误定义（332B）
│           # ffmpeg-core.wasm (32MB) 从 CDN 加载，避免 Pages 25MB 限制
├── package.json             # 开发依赖（wrangler）
└── README.md                # 本文档
```

## 🎯 使用说明

1. 访问部署的 URL（例如：`https://video2gif.pages.dev`）
2. 选择上传 MP4 文件或填写视频 URL
   - 上传文件后会自动读取视频信息
   - URL 输入后点击"🔍 分析视频"按钮获取信息
3. 调整转换参数（可选）
   - **📹 使用原视频参数**：保持原视频的分辨率和帧率
   - **预设按钮**：快速选择常用配置（高质量/平衡/低体积/表情包/3 秒片段）
4. 点击"开始转换"
5. 首次使用会下载 ffmpeg.wasm（约 30MB，之后缓存）
6. 等待浏览器端转码完成后预览和下载 GIF

## ⚙️ 技术栈

- **前端：** 原生 HTML/CSS/JavaScript（无框架）
- **转码：** ffmpeg.wasm v0.12.15（浏览器端 WebAssembly）
- **FFmpeg Core：** @ffmpeg/core v0.12.10（本地打包，避免跨域）
- **部署：** Cloudflare Pages / GitHub Pages / 任意静态托管

## 📝 注意事项

1. **首次加载**：WASM 文件（32MB）从 CDN 加载，首次使用需要下载
2. **浏览器缓存**：下载后会被浏览器缓存，后续使用无需重新下载
3. **浏览器性能**：转码速度取决于用户设备性能（支持多线程）
4. **内存占用**：大视频文件可能占用较多内存
5. **隐私安全**：所有数据在浏览器本地处理，不上传到服务器
6. **网络要求**：首次使用需要良好的网络连接（下载 30MB）

## 🔧 开发

修改 `public/index.html` 后，使用以下命令本地预览：

```bash
npm run dev
```

## 📦 部署到 Cloudflare Pages

```bash
# 初次部署
npx wrangler pages deploy public

# 后续更新
npx wrangler pages deploy public --project-name=your-project-name
```

## 与扩展的关系

该应用已从浏览器扩展中完全独立，作为单独的静态 Web 应用。用户无需安装扩展即可使用。
