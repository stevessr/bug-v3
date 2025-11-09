# WebDAV 和 S3 同步功能

本项目现在支持通过 WebDAV 和 S3 同步表情数据，允许您在不同设备之间保持表情包的一致性。

## 功能概述

- ✅ 支持 WebDAV 服务器同步
- ✅ 支持 S3 兼容存储同步
- ✅ 手动推送（Push）和拉取（Pull）操作
- ✅ 连接测试功能
- ✅ 配置本地加密存储

## 使用方法

### 1. 安装管理器脚本

首先需要安装 emoji-manager 用户脚本：

1. 构建管理器脚本：

   ```bash
   npm run build:userscript
   ```

2. 在 `dist/` 目录下找到 `emoji-manager.user.js`

3. 使用 Tampermonkey 或 Violentmonkey 安装该脚本

### 2. 配置同步

在 Discourse 页面上，您会看到几个浮动按钮：

1. **⚙️ 表情管理** - 主管理界面
2. **🔧 设置** - 设置选项
3. **📦 导入/导出** - 数据导入导出
4. **☁️ 同步** - 新增的同步功能

点击 "☁️ 同步" 按钮，选择 "⚙️ 同步配置"。

### 3. WebDAV 配置

如果您使用 WebDAV 服务器：

```
同步类型: WebDAV
服务器 URL: https://your-webdav-server.com
用户名: your-username
密码: your-password
文件路径: emoji-data.json (可选，默认为 emoji-data.json)
```

支持的 WebDAV 服务器：

- Nextcloud
- ownCloud
- Box
- Apache WebDAV
- 任何其他 WebDAV 兼容服务器

### 4. S3 配置

如果您使用 S3 或兼容服务：

```
同步类型: S3
Endpoint: s3.amazonaws.com (或您的 S3 兼容服务地址)
Region: us-east-1
Bucket: your-bucket-name
Access Key ID: your-access-key-id
Secret Access Key: your-secret-access-key
路径前缀: emoji-data.json (可选)
```

支持的 S3 兼容服务：

- Amazon S3
- MinIO
- Backblaze B2
- DigitalOcean Spaces
- Wasabi
- 任何其他 S3 兼容存储

### 5. 测试连接

配置完成后，点击 "测试连接" 按钮验证您的配置是否正确。

### 6. 同步操作

#### 推送 (Push)

将当前浏览器中的表情数据推送到远程服务器：

1. 点击 "☁️ 同步" 按钮
2. 选择 "⬆️ 推送 (Push)"
3. 等待上传完成

#### 拉取 (Pull)

从远程服务器拉取表情数据到当前浏览器：

1. 点击 "☁️ 同步" 按钮
2. 选择 "⬇️ 拉取 (Pull)"
3. 确认覆盖本地数据
4. 等待下载完成，页面将自动刷新

## 数据格式

同步的数据包含：

```json
{
  "emojiGroups": [...],
  "settings": {...},
  "timestamp": 1234567890,
  "version": "1.0"
}
```

## 安全注意事项

1. **凭证安全**：您的 WebDAV 密码和 S3 密钥存储在浏览器的 localStorage 中。请确保您的设备安全。

2. **HTTPS**：强烈建议使用 HTTPS 连接以保护传输中的数据。

3. **权限控制**：
   - WebDAV：确保您的账户只有访问特定文件/目录的权限
   - S3：使用 IAM 策略限制访问权限到特定 bucket 和对象

4. **定期备份**：虽然有同步功能，但仍建议定期导出数据作为备份。

## 最佳实践

1. **首次同步**：
   - 在首次使用时，建议先推送数据到服务器
   - 在新设备上，先拉取数据

2. **冲突处理**：
   - 拉取操作会覆盖本地数据
   - 推送操作会覆盖远程数据
   - 没有自动合并功能，请注意操作顺序

3. **多设备同步**：
   - 在切换设备前，先推送当前设备的数据
   - 在新设备上，先拉取最新数据
   - 避免同时在多个设备上修改数据

## 故障排除

### WebDAV 连接失败

- 检查 URL 是否正确（包括协议 https://）
- 验证用户名和密码
- 确认服务器允许 WebDAV 访问
- 检查 CORS 设置（如果适用）

### S3 连接失败

- 验证 Endpoint 和 Region 是否正确
- 检查 Access Key 和 Secret Key
- 确认 Bucket 存在且可访问
- 检查 Bucket 策略和 CORS 配置

### 数据同步失败

- 检查网络连接
- 验证存储空间是否充足
- 查看浏览器控制台的错误信息

## 技术实现

### 架构设计

```
src/userscript/
├── plugins/
│   └── syncTargets.ts      # 同步插件接口和实现
└── modules/
    └── syncManager.ts      # 同步管理 UI 和逻辑
```

### 扩展性

如果您想添加新的同步服务（如 Google Drive、Dropbox 等）：

1. 在 `syncTargets.ts` 中实现 `ISyncTarget` 接口
2. 在 `createSyncTarget` 工厂函数中添加新的类型
3. 在 `syncManager.ts` 中添加相应的配置 UI

示例：

```typescript
export class GoogleDriveSyncTarget implements ISyncTarget {
  async push(data: SyncData): Promise<SyncResult> {
    // 实现推送逻辑
  }

  async pull(): Promise<...> {
    // 实现拉取逻辑
  }

  async test(): Promise<SyncResult> {
    // 实现连接测试
  }
}
```

## 反馈和贡献

如果您遇到问题或有改进建议，请在 GitHub 上提交 Issue 或 Pull Request。
