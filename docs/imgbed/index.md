# API 基本介绍

CloudFlare ImgBed 提供了一系列 API 接口，方便用户和开发者进行文件上传、删除、列出，以及随机图获取等操作。

## API 端点

- **上传 API**：`/upload`
- **删除 API**：`/api/manage/delete`
- **列出 API**：`/api/manage/list`
- **随机图 API**：`/random`

## 鉴权方式

对于所有需要鉴权的接口，除另行说明外，统一采用 API Token 鉴权方式。用户需要在上传时提供有效的 API Token，才能进行相关操作。

### API Token 获取

用户可以在 CloudFlare ImgBed 的`管理界面->系统设置->安全设置->API Token管理`处生成 API Token。生成后，请妥善保存，因为出于安全考虑，Token 只会显示一次。

::: warning 注意
尽量根据所需操作设置 Token 的权限，避免使用过于宽泛的权限。

请勿将 API Token 泄露给他人，避免造成不必要的安全风险。
:::

### API Token 使用

在调用 API 时，需要在请求头中添加以下字段：

```http
Authorization: Bearer YOUR_API_TOKEN
或者
Authorization: YOUR_API_TOKEN
```

使用示例：

```bash
curl -X POST "https://your-cloudflare-imgbed-url/upload" \
-H "Authorization: Bearer YOUR_API_TOKEN" \
-F "file=@/path/to/your/image.jpg"
```
