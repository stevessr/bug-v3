# 列表 API

列表 API 支持获取 CloudFlare ImgBed 中的文件列表。

## 基本信息

- **端点**：`/api/manage/list`
- **方法**：`GET`
- **认证**：需要`list`权限
- **内容类型**：`application/json`

## 请求参数

### Query 参数

| 参数名      | 类型    | 必需 | 默认值  | 说明                                   |
| ----------- | ------- | ---- | ------- | -------------------------------------- |
| `start`     | number  | 否   | `0`     | 起始位置，用于分页                     |
| `count`     | number  | 否   | `50`    | 返回数量，`-1`表示不限制数量           |
| `sum`       | boolean | 否   | `false` | 是否只返回总数统计（count为 -1 生效）  |
| `recursive` | boolean | 否   | `false` | 是否递归获取子目录下的文件             |
| `dir`       | string  | 否   | `""`    | 指定目录路径                           |
| `search`    | string  | 否   | `""`    | 搜索关键词，支持文件名搜索             |
| `channel`   | string  | 否   | `""`    | 筛选存储渠道：`telegram`、`cfr2`、`s3` |
| `listType`  | string  | 否   | `""`    | 文件状态筛选：`None`、`Block`、`White` |
| `action`    | string  | 否   | `""`    | 特殊操作：`rebuild`、`info`            |

## 功能说明

### 普通文件列表查询

获取指定目录下的文件和子目录列表，支持分页、搜索和筛选。

### 统计查询

当 `count=-1` 且 `sum=true` 时，只返回文件总数统计（指定目录和子目录下的文件）。

### 递归查询

当 `recursive=true` 时，递归获取子目录下的所有文件。

### 特殊操作

#### 重建索引 (`action=rebuild`)

异步重建文件索引，提高查询性能。

#### 索引信息 (`action=info`)

获取索引的基本信息和状态。

## 响应格式

### 普通列表响应

```json
{
  "files": [
    {
      "name": "example/image.jpg",
      "metadata": {
        "Channel": "telegram",
        "TimeStamp": "1754020094217",
        "File-Mime": "image/jpeg",
        "File-Size": "1024000"
      }
    }
  ],
  "directories": ["example/subfolder"],
  "totalCount": 100, // 指定目录和子目录下的文件总数
  "returnedCount": 50, // 实际返回的文件数量
  "indexLastUpdated": "1754020094217",
  "isIndexedResponse": true
}
```

### 统计响应

```json
{
  "sum": 100,
  "indexLastUpdated": "1754020094217"
}
```

### 索引信息响应

```json
{
  "totalFiles": 100,
  "lastUpdated": "1754020094217",
  "channelStats": {
    "telegram": 20
  },
  "directoryStats": {
    "/": 30
  },
  "typeStats": {
    "None": 20
  },
  "oldestFile": {},
  "newestFile": {}
}
```

### 错误响应

```json
{
  "error": "Internal server error",
  "message": "详细错误信息"
}
```

## 示例

### 获取文件列表

```bash
curl --location --request GET 'https://your.domain/api/manage/list?start=0&count=50' \
--header 'Authorization: Bearer your_token'
```

### 搜索文件

```bash
curl --location --request GET 'https://your.domain/api/manage/list?search=image&count=20' \
--header 'Authorization: Bearer your_token'
```

### 获取指定目录

```bash
curl --location --request GET 'https://your.domain/api/manage/list?dir=photos/2024' \
--header 'Authorization: Bearer your_token'
```

### 按存储渠道筛选

```bash
curl --location --request GET 'https://your.domain/api/manage/list?channel=telegram' \
--header 'Authorization: Bearer your_token'
```

### 获取总数统计

```bash
curl --location --request GET 'https://your.domain/api/manage/list?count=-1&sum=true' \
--header 'Authorization: Bearer your_token'
```

### 重建索引

```bash
curl --location --request GET 'https://your.domain/api/manage/list?action=rebuild' \
--header 'Authorization: Bearer your_token'
```
