# 上传 API

上传 API 支持通过第三方上传文件至 CloudFlare ImgBed，便于集成到各种应用和服务中。

### `uploadFolder` 参数

- **类型**: `string`
- **可选**: 是
- **描述**: 指定文件上传的目录。这是一个相对路径，例如，如果您想将文件上传到 `img/test` 目录，则应填写 `img/test`。如果未指定，文件将上传到默认根目录。

## 基本信息

- **端点**：`/upload`
- **方法**：`POST`
- **认证**：使用上传认证码或 API Token（需要`upload`权限）
- **内容类型**：`multipart/form-data`
- **文件大小限制**：根据存储渠道而定

## 请求参数

### Query 参数

| 参数名           | 类型    | 必需 | 默认值     | 说明                                                                                                                                              |
| ---------------- | ------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authCode`       | string  | 否   | -          | 上传认证码                                                                                                                                        |
| `serverCompress` | boolean | 否   | `true`     | 服务端压缩（仅针对Telegram渠道的图片文件）                                                                                                        |
| `uploadChannel`  | string  | 否   | `telegram` | 上传渠道：`telegram`、`cfr2`、`s3`                                                                                                                |
| `autoRetry`      | boolean | 否   | `true`     | 失败时自动切换渠道重试                                                                                                                            |
| `uploadNameType` | string  | 否   | `default`  | 文件命名方式，可选值为`[default, index, origin, short]`，分别代表默认`前缀_原名`命名、`仅前缀`命名、`仅原名`命名和`短链接`命名法，默认为`default` |
| `returnFormat`   | string  | 否   | `default`  | 返回链接格式，可选值为`[default, full]`，分别代表默认的`/file/id`格式、完整链接格式                                                               |
| `uploadFolder`   | string  | 否   | -          | 上传目录，用相对路径表示，例如上传到img/test目录需填`img/test`                                                                                    |

### Body 参数

| 参数名 | 类型 | 必需 | 说明         |
| ------ | ---- | ---- | ------------ |
| `file` | File | 是   | 要上传的文件 |

## 响应格式

`data[0].src`为获得的图片链接（注意不包含域名，需要自己添加）

## 示例

### 请求示例

```bash
 curl --location --request POST 'https://your.domain/upload?authCode=your_authCode' \

 --header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \

 --form 'file=@"D:\\杂文件\\壁纸\\genshin109.jpg"'
```

### 响应示例

```json
[
  {
    "src": "/file/abc123_image.jpg"
  }
]
```
