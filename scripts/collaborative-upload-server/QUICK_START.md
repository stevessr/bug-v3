# upload-folder.js 快速开始

## 快速启动步骤

### 1. 启动协作上传服务器

在一个终端中运行：

```bash
cd /home/steve/文档/bug-v3/scripts/collaborative-upload-server
node server.js
```

服务器将在 `ws://localhost:9527` 启动。

### 2. 准备表情图片

将表情图片放入一个文件夹中，例如 `./my-emojis/`：

```
my-emojis/
├── smile.png
├── laugh.jpg
├── cry.gif
└── happy.webp
```

### 3. 运行上传客户端

在另一个终端中运行：

```bash
cd /home/steve/文档/bug-v3/scripts/collaborative-upload-server
node upload-folder.js ./my-emojis "我的表情" --output-file emojis.json
```

### 4. 查看输出结果

每个上传成功的表情会立即输出一个 JSON 对象（兼容 linux.do 上传接口返回格式）：

```json
{"id":"emoji-1739411200000-0-abcde","name":"smile","url":"https://linux.do/uploads/default/original/4X/e/b/b/ebbe4ff7f5a301b4696fd541ed2509aca5a5a71f.jpeg","displayUrl":"https://linux.do/uploads/default/optimized/1X/2/3/4/optimized.jpg","width":1000,"height":1000,"thumbnail_width":100,"thumbnail_height":100,"filesize":35367,"human_filesize":"34.5 KB","extension":"jpeg","short_url":"upload://xDtWLTsDH4kCD1xK4f5sempvO47.jpeg","short_path":"/uploads/short-url/xDtWLTsDH4kCD1xK4f5sempvO47.jpeg","dominant_color":"C5C5C5","groupId":"group-1739411200000","packet":1}
{"id":"emoji-1739411200000-1-fghij","name":"laugh","url":"https://linux.do/uploads/default/original/4X/f/g/h/fghij1234567890.png","displayUrl":"https://linux.do/uploads/default/optimized/1X/5/6/7/optimized.png","width":800,"height":600,"thumbnail_width":100,"thumbnail_height":100,"filesize":25600,"human_filesize":"25 KB","extension":"png","short_url":"upload://xyzABC123def456.png","short_path":"/uploads/short-url/xyzABC123def456.png","dominant_color":"FF6B6B","groupId":"group-1739411200000","packet":2}
```

## 常用命令

### 基本用法（推荐）

```bash
node upload-folder.js ./my-emojis "我的表情"
```

表情数据会自动保存到 `emojis-我的表情.json` 文件。

### 断点续传

```bash
node upload-folder.js ./my-emojis "我的表情"
```

如果输出文件已存在，会自动启用断点续传。

### 自定义输出文件名

```bash
node upload-folder.js ./my-emojis "我的表情" --output-file my-emojis.json
```

### 自定义缩图尺寸

```bash
node upload-folder.js ./my-emojis "我的表情" --thumbnail 150
```

### 指定服务器地址

```bash
node upload-folder.js ./my-emojis "我的表情" --server ws://localhost:9527
```

### 记录失败日志

```bash
node upload-folder.js ./my-emojis "我的表情" --log-file failed.log
```

## 注意事项

1. 确保服务器在运行（`node server.js`）
2. 图片尺寸由服务器返回，无需本地解析
3. 支持的图片格式：PNG, JPEG, WebP, GIF, BMP, AVIF
4. 错误信息输出到 stderr，JSON 数据默认保存到文件
5. **表情数据默认输出到 JSON 文件**，文件名为 `emojis-{分组名}.json`
6. **自动断点续传**：如果输出文件已存在，自动跳过已上传的图片