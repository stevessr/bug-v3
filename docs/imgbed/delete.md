# 删除 API

删除 API 支持删除 CloudFlare ImgBed 中的文件，包括单个文件删除和批量文件夹删除功能。

## 基本信息

- **端点**：`/api/manage/delete/{path}`
- **方法**：`GET`
- **认证**：需要`delete`权限
- **内容类型**：`application/json`

## 请求参数

### 路径参数

| 参数名 | 类型   | 必需 | 说明                                        |
| ------ | ------ | ---- | ------------------------------------------- |
| `path` | string | 是   | 文件或文件夹路径（如file.png或your/folder） |

### Query 参数

| 参数名   | 类型    | 必需 | 默认值  | 说明                                               |
| -------- | ------- | ---- | ------- | -------------------------------------------------- |
| `folder` | boolean | 否   | `false` | 是否为文件夹删除，`true`表示删除整个文件夹及其内容 |

## 功能说明

### 单文件删除

当 `folder` 参数为 `false` 或未提供时，删除指定的单个文件。

### 文件夹删除

当 `folder` 参数为 `true` 时，递归删除指定文件夹及其所有子文件夹和文件。

## 响应格式

### 单文件删除成功响应

```json
{
  "success": true,
  "fileId": "example/image.jpg"
}
```

### 文件夹删除成功响应

```json
{
  "success": true,
  "deleted": ["folder/image1.jpg", "folder/image2.png", "folder/subfolder/image3.gif"],
  "failed": []
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Delete file failed"
}
```

## 示例

### 删除单个文件

```bash
curl --location --request DELETE 'https://your.domain/api/manage/delete/example/image.jpg' \
--header 'Authorization: Bearer your_token'
```

### 删除文件夹

```bash
curl --location --request DELETE 'https://your.domain/api/manage/delete/example/folder?folder=true' \
--header 'Authorization: Bearer your_token'
```
