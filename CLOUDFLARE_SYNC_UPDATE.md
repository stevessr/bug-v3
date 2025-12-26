# Cloudflare 同步功能更新说明

## 📌 重要变更

backup-worker 已合并到 cfworker 项目中，API 路径已变更。

## ⚠️ 需要更新的配置

### 如果你之前配置了 Cloudflare Worker 同步：

**旧的 URL 格式**（不再工作）:

```
https://your-worker.your-account.workers.dev
```

**新的 URL 格式**（必须包含 `/api/backup`）:

```
https://your-pages-project.pages.dev/api/backup
```

## 🔧 更新步骤

### 1. 部署新的 Pages Function

```bash
cd scripts/cfworker

# 首次部署
npx wrangler pages deploy public

# 配置 KV 命名空间（如果还没有）
npx wrangler kv:namespace create "EMOJI_BACKUP"
npx wrangler kv:namespace create "EMOJI_BACKUP" --preview

# 更新 wrangler.toml 中的 namespace ID

# 设置生产环境密钥
npx wrangler pages secret put AUTH_SECRET --project-name=your-project
npx wrangler pages secret put AUTH_SECRET_READONLY --project-name=your-project
```

### 2. 更新浏览器扩展中的配置

**重要提示**：现在可以先测试连接，再保存配置！

1. **重新加载扩展**（使用新构建的版本）:

   ```bash
   npm run build  # 如果还没构建
   ```

   然后在浏览器扩展管理页面重新加载扩展

2. **配置 Worker URL**:
   - 打开扩展设置页面 → 同步设置
   - 选择 "☁️ Cloudflare Worker"
   - 在 "Worker URL" 字段中输入：`https://your-project.pages.dev/api/backup`
   - ⚠️ **必须包含 `/api/backup` 路径！**
   - 输入 "认证令牌"（读写权限）
   - 可选：输入 "只读认证令牌"

3. **测试连接**:
   - 点击 "测试连接" 按钮
   - **现在不需要先保存配置**，可以直接测试表单中的配置
   - 应该显示 "连接测试成功"

4. **保存配置**:
   - 测试成功后，点击 "保存配置"
   - 配置会被保存到扩展存储中

### 3. （可选）删除旧的 Worker 部署

```bash
# 查看已部署的 workers
wrangler list

# 删除旧的 backup-worker
wrangler delete backup-worker
```

## 🧪 验证配置

### 使用 curl 测试新 API

```bash
# 测试列出所有备份键（使用只读令牌）
curl -H "Authorization: Bearer YOUR_READONLY_TOKEN" \
  https://your-project.pages.dev/api/backup

# 应该返回 JSON 数组，例如: [{"name":"settings"},{"name":"分组名"}]
```

### 在扩展中测试

1. 扩展设置 → 同步设置 → 点击 "测试连接"
2. 应该显示 "连接测试成功"
3. 尝试推送或拉取数据

## ✅ 已修复的问题

### 问题 1: "SyntaxError: Unexpected token '<'"

**原因**: API 路径从 `/` 改为 `/api/backup`，旧代码访问错误路径返回 HTML
**修复**: 更新 `src/utils/syncTargets.ts` 中所有 API 调用路径

### 问题 2: "Unauthorized: Invalid token"

**原因**: 测试连接使用已保存的配置，而不是表单中当前填写的配置
**修复**: 修改 `testSyncConnection` 方法支持临时配置参数，现在可以在保存前测试配置

## ❓ 常见问题

### Q: 为什么会出现 "SyntaxError: Unexpected token '<'" 错误？

**A**: 这是因为你还在使用旧的 URL 格式，返回的是 HTML 页面而不是 JSON。请确保 URL 包含 `/api/backup` 路径。

### Q: 之前备份的数据会丢失吗？

**A**: 不会。如果你使用相同的 KV namespace，数据会保留。但你需要更新 URL 才能访问。

### Q: 需要重新生成令牌吗？

**A**: 不需要。如果你使用相同的密钥（AUTH_SECRET 和 AUTH_SECRET_READONLY），旧的令牌仍然有效。

### Q: 我可以同时保留旧的 Worker 和新的 Pages Function 吗？

**A**: 可以，但没有必要。它们会访问相同的 KV 数据。建议只使用新的 Pages Function。

## 📝 技术细节

- **旧架构**: 独立的 Cloudflare Worker
- **新架构**: Cloudflare Pages Function (在 `functions/api/backup/[[key]].ts`)
- **API 路由**: 使用 catch-all 路由 `[[key]]` 处理动态路径
- **兼容性**: 所有 API 操作（GET/POST/DELETE）保持不变，仅路径前缀改变

## 📚 相关文档

- [scripts/cfworker/README.md](scripts/cfworker/README.md) - 完整的 API 文档
- [scripts/cfworker/MIGRATION.md](scripts/cfworker/MIGRATION.md) - 详细的迁移指南
- [Cloudflare Pages Functions 文档](https://developers.cloudflare.com/pages/functions/)
