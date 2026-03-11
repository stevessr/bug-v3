# Cloudflare Pages - 多功能静态应用

**包含视频转 GIF 工具和表情包备份 API**

## 📂 项目组成

### 1. 视频转 GIF 工具（静态应用）

完全在浏览器中运行的视频转 GIF 工具，无需后端服务

### 2. 表情包备份 API（Cloudflare Function）

基于 Cloudflare KV 的表情包备份服务 API

### 3. 随机图片 API（Cloudflare Function）

从表情包市场随机返回图片的 API

## ✨ 特性

### 视频转 GIF

- ✅ 纯前端，完全在浏览器中运行
- ✅ 无需后端服务器或 API
- ✅ 数据不上传，完全本地处理
- ✅ 支持文件上传和 URL 下载
- ✅ 自定义参数：FPS、宽度、高度、时间段
- ✅ 实时日志显示
- ✅ 响应式设计

### 表情包备份 API

- ✅ 基于 Cloudflare KV 存储
- ✅ 支持读写权限分离
- ✅ CORS 支持
- ✅ RESTful API 设计

### 随机图片 API

- ✅ 从 78 个表情包分组中随机返回图片
- ✅ 支持按分组筛选
- ✅ 支持批量获取（最多 10 张）
- ✅ 支持 JSON 和重定向两种格式

## 🚀 快速部署

### 部署到 Cloudflare Pages

```bash
cd scripts/cfworker

# 首次部署
npx wrangler pages deploy public

# 配置 KV 命名空间
npx wrangler kv:namespace create "EMOJI_BACKUP"
npx wrangler kv:namespace create "EMOJI_BACKUP" --preview

# 配置环境变量（Secrets）
npx wrangler pages secret put AUTH_SECRET --project-name=your-project
npx wrangler pages secret put AUTH_SECRET_READONLY --project-name=your-project
```

### 本地开发

```bash
cd scripts/cfworker
npm install
npm run dev
```

访问 `http://localhost:8788`

## 📁 项目结构

```
scripts/cfworker/
├── public/                   # 静态文件
│   ├── index.html           # 视频转 GIF 应用
│   ├── webcodecs-check.html # WebCodecs 测试页面
│   └── assets/
│       ├── json/            # 表情包数据
│       └── js/              # JavaScript 资源
├── functions/               # Cloudflare Functions (API 路由)
│   └── api/
│       ├── backup/
│       │   └── [[key]].ts  # 表情包备份 API (原 backup-worker)
│       ├── random-image.ts # 随机图片 API
│       ├── proxy/
│       │   └── telegram-file.js
│       └── video/
│           └── proxy.js
├── wrangler.toml           # Cloudflare 配置
└── README.md               # 本文档
```

## 📡 API 文档

### 表情包备份 API

所有请求需要在 Header 中携带：`Authorization: Bearer <token>`

#### 1. 列出所有备份键

```bash
GET /api/backup
Authorization: Bearer <readonly-token>
```

#### 2. 获取指定备份

```bash
GET /api/backup/:key
Authorization: Bearer <readonly-token>
```

#### 3. 保存备份

```bash
POST /api/backup/:key
Authorization: Bearer <write-token>
Content-Type: application/json

{备份数据}
```

#### 4. 删除备份

```bash
DELETE /api/backup/:key
Authorization: Bearer <write-token>
```

### 示例

**⚠️ 注意**：如果你之前使用独立的 backup-worker，现在 API 路径已改为 `/api/backup`。

```bash
# 列出所有备份
curl -H "Authorization: Bearer readonly-token" \
  https://your-project.pages.dev/api/backup

# 获取备份
curl -H "Authorization: Bearer readonly-token" \
  https://your-project.pages.dev/api/backup/user123

# 保存备份
curl -X POST \
  -H "Authorization: Bearer write-token" \
  -H "Content-Type: application/json" \
  -d '{"groups":[...]}' \
  https://your-project.pages.dev/api/backup/user123

# 删除备份
curl -X DELETE \
  -H "Authorization: Bearer write-token" \
  https://your-project.pages.dev/api/backup/user123
```

**浏览器扩展配置**：在扩展的同步设置中，Worker URL 应设置为：

```
https://your-project.pages.dev/api/backup
```

### 随机图片 API

#### 1. 获取一张随机图片（JSON 格式）

```bash
curl https://your-project.pages.dev/api/random-image
```

返回示例：

```json
{
  "id": "emoji-1758073408523-ggg1vh",
  "name": "哭泣",
  "url": "https://linuxdo-uploads.s3.linux.do/original/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2.jpeg",
  "groupId": "group-1758073408523",
  "width": 1000,
  "height": 993,
  "packet": 2
}
```

#### 2. 直接重定向到图片 URL

```bash
curl -L https://your-project.pages.dev/api/random-image?format=redirect

# 在浏览器中直接访问会显示随机图片
# 可以用作随机头像、随机背景等
```

#### 3. 从指定分组获取随机图片

```bash
# 获取 Nachoneko 表情包的随机图片
curl https://your-project.pages.dev/api/random-image?group=group-1758073408523

# 获取仙狐小姐表情包的随机图片
curl https://your-project.pages.dev/api/random-image?group=group-1755970088527
```

#### 4. 获取多张随机图片（最多 10 张）

```bash
# 获取 3 张随机图片
curl https://your-project.pages.dev/api/random-image?count=3

# 从指定分组获取 5 张随机图片
curl "https://your-project.pages.dev/api/random-image?group=group-1758073408523&count=5"
```

#### 5. 查询参数说明

- `group`: (可选) 分组 ID，从 manifest.json 中获取
- `count`: (可选) 返回图片数量，1-10 之间，默认为 1
- `format`: (可选) 返回格式
  - `json` (默认): 返回图片元数据
  - `redirect`: HTTP 302 重定向到图片 URL（仅在 count=1 时有效）

#### 6. 使用场景示例

**作为随机头像 API**:

```html
<img src="https://your-project.pages.dev/api/random-image?format=redirect" alt="Random Avatar" />
```

**每次刷新显示不同图片**:

```html
<img id="randomEmoji" alt="Random Emoji" />
<button onclick="loadRandomEmoji()">换一张</button>

<script>
  function loadRandomEmoji() {
    fetch('https://your-project.pages.dev/api/random-image')
      .then(res => res.json())
      .then(data => {
        document.getElementById('randomEmoji').src = data.url
        document.getElementById('randomEmoji').alt = data.name
      })
  }
  loadRandomEmoji()
</script>
```

**获取特定风格的随机表情包**:

```javascript
// 获取猫猫表情包
fetch('https://your-project.pages.dev/api/random-image?group=group-1758073408523')
  .then(res => res.json())
  .then(data => console.log('随机猫猫：', data.name, data.url))
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
