# upload-folder.js 使用说明

## 功能说明

`upload-folder.js` 是一个连接到协作上传服务器的客户端脚本，用于上传文件夹中的图片并生成表情分组风格的 JSON。

## 用法

```bash
node upload-folder.js [upload folder] <emoji group name> [options]
```

### 参数说明

- `[upload folder]` - 要上传的文件夹路径（必需）
- `<emoji group name>` - 表情分组名称（必需）

### 选项

- `--server <url>` - 服务器地址（默认：ws://localhost:9527）
- `--thumbnail <size>` - 缩图尺寸（默认：100）
- `--output-file <path>` - 输出 JSON 文件路径（默认：emojis-{name}.json）
- `--log-file <path>` - 失败日志文件路径（默认：emojis-{name}-failed.log）
- `--resume` - 显式启用断点续传（如果文件已存在，自动启用）
- `--max-retries <num>` - 最大重试次数（默认：8）
- `--retry-delay <ms>` - 重试基础延迟（默认：1000ms）

**注意**：表情数据默认会保存到 JSON 文件，无需手动指定输出文件。如果输出文件已存在，会自动启用断点续传模式。

## 使用示例

### 基本用法

```bash
node upload-folder.js ./my-emojis "我的表情"
```

表情数据会自动保存到 `emojis-我的表情.json` 文件。

### 指定服务器地址

```bash
node upload-folder.js ./my-emojis "我的表情" --server ws://localhost:9527
```

### 记录失败日志

```bash
node upload-folder.js ./my-emojis "我的表情" --log-file failed.log
```

如果上传失败，日志文件格式如下：

```
# Upload Failure Log
# Generated: 2026-02-13T10:30:00.000Z
# Folder: /path/to/my-emojis
# Group: 我的表情
# Total: 10, Succeeded: 8, Failed: 2

[5/10] failed_image.png
  Path: /path/to/my-emojis/subfolder/failed_image.png
  Error: 429 Too Many Requests
  Time: 2026-02-13T10:30:05.000Z

[8/10] large_image.jpg
  Path: /path/to/my-emojis/large_image.jpg
  Error: File too large
  Time: 2026-02-13T10:30:08.000Z
```

### 自定义缩图尺寸

```bash
node upload-folder.js ./my-emojis "我的表情" --thumbnail 150
```

### 输出到文件

```bash
node upload-folder.js ./my-emojis "我的表情" --output-file emojis.json
```

表情数据会自动保存到指定的 JSON 文件中。

### 断点续传

```bash
node upload-folder.js ./my-emojis "我的表情"
```

如果 `emojis-我的表情.json` 文件已存在，会自动启用断点续传，跳过已上传的图片。

也可以使用 `--resume` 参数显式启用：

```bash
node upload-folder.js ./my-emojis "我的表情" --resume
```

断点续传功能会：
- 读取已存在的 JSON 文件
- 跳过已上传的表情
- 只上传新的表情
- 自动合并新旧表情数据

### 自定义重试参数

```bash
node upload-folder.js ./my-emojis "我的表情" --max-retries 10 --retry-delay 2000
```

### 自定义输出文件名

```bash
node upload-folder.js ./my-emojis "我的表情" --output-file my-custom-emojis.json
```

### 禁用流式输出

```bash
node upload-folder.js ./my-emojis "我的表情" --no-stream > output.json
```

## 输出格式

### 流式输出（默认）

每个上传成功的表情会立即输出一个 JSON 对象（兼容 linux.do 上传接口返回格式）：

```json
{
  "id": "emoji-group-1234567890-0-abcde",
  "name": "emoji1",
  "url": "https://linux.do/uploads/default/original/4X/e/b/b/ebbe4ff7f5a301b4696fd541ed2509aca5a5a71f.jpeg",
  "displayUrl": "https://linux.do/uploads/default/optimized/1X/2/3/4/optimized.jpg",
  "width": 1000,
  "height": 1000,
  "thumbnail_width": 100,
  "thumbnail_height": 100,
  "filesize": 35367,
  "human_filesize": "34.5 KB",
  "extension": "jpeg",
  "short_url": "upload://xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
  "short_path": "/uploads/short-url/xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
  "dominant_color": "C5C5C5",
  "groupId": "group-1234567890",
  "packet": 1
}
```

### 非流式输出（--no-stream）

等待所有上传完成后，输出一个完整的 JSON 数组：

```json
[
  {
    "id": "emoji-group-1234567890-0-abcde",
    "name": "emoji1",
    "url": "https://linux.do/uploads/default/original/4X/e/b/b/ebbe4ff7f5a301b4696fd541ed2509aca5a5a71f.jpeg",
    "displayUrl": "https://linux.do/uploads/default/optimized/1X/2/3/4/optimized.jpg",
    "width": 1000,
    "height": 1000,
    "thumbnail_width": 100,
    "thumbnail_height": 100,
    "filesize": 35367,
    "human_filesize": "34.5 KB",
    "extension": "jpeg",
    "short_url": "upload://xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
    "short_path": "/uploads/short-url/xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
    "dominant_color": "C5C5C5",
    "groupId": "group-1234567890",
    "packet": 1
  },
  {
    "id": "emoji-group-1234567890-1-fghij",
    "name": "emoji2",
    "url": "https://linux.do/uploads/default/original/4X/f/g/h/fghij1234567890.png",
    "displayUrl": "https://linux.do/uploads/default/optimized/1X/5/6/7/optimized.png",
    "width": 800,
    "height": 800,
    "thumbnail_width": 100,
    "thumbnail_height": 100,
    "filesize": 25600,
    "human_filesize": "25 KB",
    "extension": "png",
    "short_url": "upload://xyzABC123def456.png",
    "short_path": "/uploads/short-url/xyzABC123def456.png",
    "dominant_color": "FF6B6B",
    "groupId": "group-1234567890",
    "packet": 2
  }
]
```

## 输出字段说明

| 字段 | 说明 |
|------|------|
| `id` | 表情唯一标识符 |
| `name` | 表情名称（文件名，不包含扩展名） |
| `url` | 原始图片 URL |
| `displayUrl` | 缩图 URL（优先使用服务器返回的 thumbnail 字段，否则使用 URL 添加 thumbnail 参数） |
| `width` | 图片宽度（像素） |
| `height` | 图片高度（像素） |
| `thumbnail_width` | 缩图宽度（像素） |
| `thumbnail_height` | 缩图高度（像素） |
| `filesize` | 文件大小（字节） |
| `human_filesize` | 人类可读的文件大小（如 "34.5 KB"） |
| `extension` | 文件扩展名（如 "jpeg"、"png"） |
| `short_url` | 短 URL（如 "upload://xDtWLTsDH4kCD1xK4f5sempvO47.jpeg"） |
| `short_path` | 短路径（如 "/uploads/short-url/xDtWLTsDH4kCD1xK4f5sempvO47.jpeg"） |
| `dominant_color` | 主色调（十六进制颜色值，如 "C5C5C5"） |
| `groupId` | 分组唯一标识符 |
| `packet` | 表情在分组中的序号 |

## 前置要求

1. **Node.js** >= 18.0.0
2. **协作上传服务器** - 需要先启动服务器
   ```bash
   node server.js
   ```

## 支持的图片格式

- PNG (.png)
- JPEG (.jpg, .jpeg)
- WebP (.webp)
- GIF (.gif)
- BMP (.bmp)
- TIFF (.tif, .tiff)
- AVIF (.avif)

## 注意事项

1. 脚本会递归扫描文件夹中的所有图片文件
2. 图片文件按字母顺序排序后上传
3. 错误信息输出到 stderr，JSON 输出到 stdout
4. 流式模式下，每个表情上传成功后立即输出
5. 图片尺寸由服务器返回，无需本地解析
6. 兼容 linux.do 上传接口返回格式，支持以下字段：
   - `width`, `height` - 图片尺寸（由服务器返回）
   - `thumbnail_width`, `thumbnail_height` - 缩图尺寸
   - `short_url`, `short_path` - 短 URL 和短路径
   - `dominant_color` - 主色调
   - `human_filesize` - 人类可读的文件大小
7. **429 等待机制**：
   - 自动检测 429 Too Many Requests 错误
   - 根据服务器返回的 `wait_seconds` 自动等待
   - 如果没有提供等待时间，使用指数退避策略
   - 支持自定义最大重试次数和重试延迟
8. **断点续传**：
   - 使用 `--resume` 参数启用
   - 自动跳过已上传的图片
   - 适合大量图片的上传任务

## 故障排查

### 连接失败

确保协作上传服务器正在运行：

```bash
node server.js
```

### 未找到图片文件

检查文件夹路径是否正确，并确保文件夹中包含支持的图片格式。

### 图片尺寸无法识别

如果图片尺寸返回为 null，可能是：
1. 图片文件损坏
2. 图片格式不受支持（目前支持：PNG, JPEG, GIF, WebP, BMP, AVIF）
3. 文件太小或不是有效的图片文件