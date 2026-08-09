# Cloudflare Pages 部署指南

## 🎉 已部署成功！

你的 Cloudflare Pages 已部署到：

```
https://902d00ad.s.pwsh.us.kg
```

## 🔐 配置生产环境密钥（重要！）

当前部署使用的是开发环境的占位符密钥。为了安全，你需要设置生产环境的密钥：

```bash
cd scripts/cfworker

# 设置读写权限的认证令牌
pnpm exec wrangler pages secret put AUTH_SECRET --project-name=video2gif-pages

# 设置只读权限的认证令牌
pnpm exec wrangler pages secret put AUTH_SECRET_READONLY --project-name=video2gif-pages
```

运行这些命令时，Wrangler 会提示你输入密钥值。**请使用强密码！**

### 生成安全密钥示例

```bash
# Linux/macOS - 生成随机密钥
openssl rand -base64 32

# 或使用在线工具
# https://www.random.org/strings/
```

## 📱 在浏览器扩展中配置

### 1. 重新加载扩展

确保使用最新构建的扩展版本（已包含修复）

### 2. 配置同步设置

1. 打开扩展设置 → 同步设置
2. 选择 "☁️ Cloudflare Worker"
3. **Worker URL**: `https://902d00ad.s.pwsh.us.kg/api/backup`
   - ⚠️ 注意必须包含 `/api/backup` 路径！
4. **认证令牌**: 输入你刚才设置的 `AUTH_SECRET` 值
5. **只读认证令牌**（可选）: 输入 `AUTH_SECRET_READONLY` 值
6. 点击 **"测试连接"** → 应该显示成功
7. 点击 **"保存配置"**

### 3. 测试同步功能

- 点击 "推送到云端" → 上传你的表情包数据
- 点击 "从云端拉取" → 下载数据
- 点击 "双向同步" → 自动合并本地和云端数据

## 🧪 测试 API

### 使用 curl 测试

```bash
# 替换 YOUR_TOKEN 为你设置的实际令牌

# 1. 测试列出所有备份键
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://902d00ad.s.pwsh.us.kg/api/backup

# 应该返回 JSON 数组，例如: []（如果还没有数据）或 [{"name":"settings"}]

# 2. 测试推送数据
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}' \
  https://902d00ad.s.pwsh.us.kg/api/backup/test-key

# 应该返回: Backup successful for key: test-key

# 3. 测试获取数据
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://902d00ad.s.pwsh.us.kg/api/backup/test-key

# 应该返回: {"test":"data"}

# 4. 测试删除数据
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://902d00ad.s.pwsh.us.kg/api/backup/test-key

# 应该返回: Deleted key: test-key
```

## 🌐 访问静态网站

### Video2GIF 工具

访问首页即可使用视频转 GIF 工具：

```
https://902d00ad.s.pwsh.us.kg/
```

### WebCodecs 测试页面

检查浏览器是否支持 WebCodecs API：

```
https://902d00ad.s.pwsh.us.kg/webcodecs-check.html
```

## 📊 Cloudflare Dashboard

### 查看部署状态

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Workers & Pages → video2gif-pages
3. 查看：
   - 部署历史
   - 实时日志
   - 分析数据
   - KV 存储内容

### 管理 KV 存储

1. Workers & Pages → KV
2. 找到 `EMOJI_BACKUP` namespace
3. 可以查看/编辑/删除存储的数据

## 🔄 更新部署

### 方式 1: 使用脚本（推荐）

```bash
pnpm update:data
```

### 方式 2: 手动部署

```bash
cd scripts/cfworker
pnpm deploy
```

### 方式 3: Git 集成（自动部署）

如果你把代码推送到 GitHub，可以配置自动部署：

1. Cloudflare Dashboard → video2gif-pages → Settings
2. Builds & deployments → Connect to Git
3. 选择你的 GitHub 仓库
4. 每次推送到 master 分支时自动部署

## 🔒 安全建议

1. **不要在代码中硬编码密钥** - 使用 `wrangler pages secret put`
2. **定期更换密钥** - 如果怀疑泄露，立即更换
3. **使用只读令牌** - 对于只需要读取的客户端
4. **限制 CORS** - 如果需要，可以修改 `functions/api/backup/[[key]].ts` 中的 CORS 设置

## 📝 环境变量说明

### `AUTH_SECRET` (读写权限)

- 用于 POST (创建/更新) 和 DELETE (删除) 操作
- 应该只给需要完全控制的客户端

### `AUTH_SECRET_READONLY` (只读权限)

- 用于 GET 操作（列出键、获取数据）
- 可以分享给只需要读取数据的客户端
- 如果不设置，会使用 `AUTH_SECRET`

## ❓ 常见问题

### Q: 为什么我的测试连接失败？

A: 检查以下几点：

1. URL 是否包含 `/api/backup` 路径
2. 认证令牌是否正确
3. 是否已设置生产环境的密钥（`wrangler pages secret put`）

### Q: 如何查看错误日志？

A:

1. Cloudflare Dashboard → video2gif-pages
2. 点击最新的部署
3. 查看 "Real-time Logs"

### Q: 数据存储在哪里？

A: 数据存储在 Cloudflare KV 中，全球分布式，高可用

### Q: 有数据大小限制吗？

A: KV 单个值限制 25 MB，对于表情包备份完全足够

### Q: 如何备份 KV 数据？

A: 可以使用扩展的 "从云端拉取" 功能下载到本地

## 🎯 下一步

1. ✅ 设置生产环境密钥
2. ✅ 在扩展中配置同步
3. ✅ 测试推送/拉取功能
4. ⭐ （可选）配置自定义域名
5. ⭐ （可选）设置 Git 自动部署

## 🆘 需要帮助？

- Cloudflare Pages 文档：https://developers.cloudflare.com/pages/
- Cloudflare KV 文档：https://developers.cloudflare.com/kv/
- Wrangler 文档：https://developers.cloudflare.com/workers/wrangler/
