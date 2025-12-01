# 同步功能测试指南

本文档提供 WebDAV 和 S3 同步功能的测试指南和示例配置。

## 快速测试

### 前提条件

1. 已构建管理器脚本：`npm run build:userscript`
2. 已在浏览器中安装 Tampermonkey 或 Violentmonkey
3. 已安装 `dist/emoji-manager.user.js`
4. 访问任何 Discourse 论坛网站

### 测试步骤

#### 1. 访问同步界面

1. 在 Discourse 页面上，点击右下角的 "☁️ 同步" 按钮
2. 如果是首次使用，点击 "⚙️ 同步配置"

#### 2. 配置 WebDAV（示例）

使用测试 WebDAV 服务器（如 Nextcloud）：

```
同步类型: WebDAV
服务器 URL: https://your-nextcloud.example.com/remote.php/dav/files/username/
用户名: your-username
密码: your-app-password
文件路径: emoji-data.json
```

**提示**：

- Nextcloud 建议使用应用专用密码而非主密码
- URL 应该指向您的 WebDAV 目录
- 文件路径是相对于 WebDAV 根目录的

#### 3. 配置 S3（示例）

使用 MinIO 本地测试服务器：

```
同步类型: S3
Endpoint: localhost:9000
Region: us-east-1
Bucket: emoji-data
Access Key ID: minioadmin
Secret Access Key: minioadmin
路径前缀: emoji-data.json
```

**MinIO 设置**：

```bash
# 使用 Docker 运行 MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"

# 创建 bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/emoji-data
mc anonymous set public local/emoji-data
```

#### 4. 测试连接

1. 填写配置后，点击 "测试连接"
2. 应该看到成功或失败消息
3. 如果成功，点击 "保存配置"

#### 5. 测试推送 (Push)

1. 返回同步操作界面
2. 点击 "⬆️ 推送 (Push)"
3. 等待上传完成
4. 验证文件已在服务器上创建

**验证方法**：

- WebDAV：通过 Web 界面或 WebDAV 客户端查看文件
- S3：使用 S3 浏览器或 AWS CLI 查看对象

#### 6. 测试拉取 (Pull)

1. （可选）在另一个浏览器或设备上重复步骤 1-4
2. 点击 "⬇️ 拉取 (Pull)"
3. 确认覆盖本地数据
4. 页面应该自动刷新
5. 验证表情数据已更新

## 测试场景

### 场景 1：单设备备份

1. 在设备 A 上配置同步
2. 添加或修改一些表情
3. 推送到服务器
4. 清除浏览器数据
5. 重新访问页面并配置同步
6. 拉取数据验证恢复

### 场景 2：多设备同步

1. 在设备 A 上推送初始数据
2. 在设备 B 上配置同步并拉取数据
3. 在设备 B 上修改数据并推送
4. 在设备 A 上拉取更新
5. 验证两个设备数据一致

### 场景 3：错误处理

1. 测试无效凭证
2. 测试不存在的服务器
3. 测试网络断开
4. 验证错误消息是否清晰

### 场景 4：大数据量

1. 导入包含大量表情的配置
2. 测试推送性能
3. 测试拉取性能
4. 验证数据完整性

## 常见问题排查

### WebDAV 问题

#### 401 Unauthorized

- 检查用户名和密码
- 对于 Nextcloud，确保使用应用密码
- 验证 URL 是否正确

#### 404 Not Found

- 检查服务器 URL
- 确认 WebDAV 路径存在
- 验证文件路径是否正确

#### CORS 错误

- WebDAV 服务器需要配置 CORS 头
- 对于 Nextcloud，这通常已经配置好
- 对于自定义服务器，添加必要的 CORS 头：
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, PUT, OPTIONS
  Access-Control-Allow-Headers: Authorization, Content-Type
  ```

### S3 问题

#### 403 Forbidden

- 检查 Access Key 和 Secret Key
- 验证 bucket 权限
- 确认 IAM 策略允许 PutObject 和 GetObject

#### 404 Not Found

- 确认 bucket 存在
- 验证 endpoint 正确
- 检查 region 设置

#### 签名错误

- 验证时间同步（AWS 签名对时间敏感）
- 检查 endpoint 格式
- 确认 region 匹配

## 调试技巧

### 1. 浏览器控制台

打开开发者工具的控制台标签，查看：

- `[Sync Manager]` 日志消息
- 网络请求和响应
- 错误堆栈跟踪

### 2. 网络监控

在开发者工具的网络标签中：

- 查看 HTTP 请求和响应代码
- 检查请求头（Authorization, Content-Type）
- 查看响应体内容

### 3. localStorage 检查

在控制台中运行：

```javascript
// 查看同步配置
console.log(JSON.parse(localStorage.getItem('emoji_extension_sync_config')))

// 查看表情数据
console.log(JSON.parse(localStorage.getItem('emoji_extension_userscript_data')))
```

### 4. 清除配置

如果需要重新开始：

```javascript
// 清除同步配置
localStorage.removeItem('emoji_extension_sync_config')
```

## 性能基准

预期性能（取决于网络和服务器）：

| 操作 | 小数据集 (10 个表情) | 大数据集 (1000 个表情) |
| ---- | ------------------- | --------------------- |
| Push | < 1 秒               | 2-5 秒                 |
| Pull | < 1 秒               | 2-5 秒                 |
| Test | < 0.5 秒             | < 0.5 秒               |

## 数据示例

同步的 JSON 数据结构：

```json
{
  "emojiGroups": [
    {
      "id": "group1",
      "name": "测试分组",
      "icon": "😀",
      "order": 0,
      "emojis": [
        {
          "packet": 1234567890,
          "name": "emoji1",
          "url": "https://example.com/emoji1.png"
        }
      ]
    }
  ],
  "settings": {
    "imageScale": 30,
    "gridColumns": 4,
    "outputFormat": "markdown",
    "forceMobileMode": false,
    "defaultGroup": "group1",
    "showSearchBar": true,
    "enableFloatingPreview": true,
    "enableCalloutSuggestions": true,
    "enableBatchParseImages": true
  },
  "timestamp": 1234567890000,
  "version": "1.0"
}
```

## 安全测试

### 1. 凭证存储

- 验证密码在 UI 中显示为 password 类型
- 检查 localStorage 中的配置（应该是明文）
- 确认安全警告显示正确

### 2. HTTPS

- 尽量使用 HTTPS 连接
- 验证证书错误处理

### 3. 权限限制

- 对于 S3，测试 IAM 策略限制
- 对于 WebDAV，测试目录权限

## 反馈

测试后请报告：

1. 成功/失败的配置
2. 遇到的错误和解决方法
3. 性能观察
4. 改进建议

在 GitHub Issues 中提交反馈：https://github.com/stevessr/bug-v3/issues
