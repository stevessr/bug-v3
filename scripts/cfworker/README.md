# Video to GIF API - 视频转 GIF 独立服务

完全独立的视频转 GIF Web 应用，包含完整的前端 UI 和后端 API，可部署到 Vercel、Railway 等支持 Node.js 的平台。

## 功能特性

- ✅ 完整的 Web UI（无需扩展）
- ✅ 支持上传 MP4 文件或提供视频 URL
- ✅ 自定义参数：FPS、宽度、高度、起始时间、持续时长
- ✅ 使用 ffmpeg-static 进行高效转码
- ✅ 实时预览和下载 GIF
- ✅ 响应式设计，支持移动端

## 快速部署

### 方案一：Vercel（推荐，一键部署）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo)

或手动部署：

```bash
cd scripts/cfworker
npm install
npx vercel
```

部署完成后访问：`https://your-app.vercel.app`

### 方案二：Railway

1. 在 [Railway](https://railway.app) 创建项目
2. 连接 GitHub 仓库
3. 设置根目录为 `scripts/cfworker`
4. Railway 会自动检测并部署

### 方案三：本地运行

```bash
cd scripts/cfworker
npm install
npm run dev
```

访问 `http://localhost:3000`

## 项目结构

```
scripts/cfworker/
├── public/
│   └── index.html      # 前端 UI（完整的 SPA）
├── server.js           # Express 后端 API
├── package.json        # 依赖配置
├── vercel.json         # Vercel 部署配置
└── README.md           # 本文档
```

## 使用说明

1. 访问部署后的 URL（例如：`https://your-app.vercel.app`）
2. 选择上传 MP4 文件或填写视频 URL
3. 调整转换参数（可选）
4. 点击"开始转换"
5. 等待转码完成后预览和下载 GIF

## API 接口（可选）

如需集成到其他应用，可直接调用 API：

### POST `/api/video2gif`

**请求格式：** `multipart/form-data`

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 二选一 | MP4 视频文件 |
| url | String | 二选一 | 视频直链 |
| fps | Number | 否 | 帧率（默认 10） |
| width | Number | 否 | 宽度（像素） |
| height | Number | 否 | 高度（像素，-1 为自动） |
| startTime | Number | 否 | 起始时间（秒） |
| duration | Number | 否 | 持续时长（秒） |

**响应：**

- Content-Type: `image/gif`
- Body: GIF 二进制流

**示例：**

```bash
curl -X POST https://your-api-domain/api/video2gif \
  -F "url=https://example.com/video.mp4" \
  -F "fps=10" \
  -F "width=480" \
  --output result.gif
```

## 本地开发

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:3000/api/video2gif` 测试。

## 环境要求

- Node.js 18+
- 至少 512MB 内存
- ffmpeg-static（自动安装）

## 注意事项

1. 视频文件大小限制取决于部署平台（Vercel 免费版：4.5MB，Railway：无限制）
2. 转码时间取决于视频长度和服务器性能
3. 建议添加速率限制和身份验证（生产环境）

## 与扩展的关系

该服务已从浏览器扩展中完全独立，作为单独的 Web 应用部署。用户无需安装扩展即可使用。

## 技术栈

- 前端：原生 HTML/CSS/JavaScript（无框架依赖）
- 后端：Node.js + Express
- 转码：ffmpeg-static
- 部署：Vercel/Railway/任意 Node.js 平台
