# 用于油猴脚本备份的 Cloudflare Worker

该 Worker 为表情扩展的油猴脚本版本提供了一个安全的备份和恢复服务。它使用 Cloudflare KV 进行存储，并需要一个秘密令牌进行授权。

## API 端点

- `POST /`: 将请求体保存到 KV 存储中。需要 `Authorization` 请求头。
- `GET /`: 从 KV 存储中检索数据。需要 `Authorization` 请求头。

## 设置和部署

1.  **安装依赖：**
    ```bash
    # 导航到此目录
    cd scripts/backup-worker

    # 安装 wrangler
    pnpm install
    ```

2.  **配置 `wrangler.toml`:**
    打开 `wrangler.toml` 文件，并添加您的 Cloudflare `account_id`。

3.  **创建 KV 命名空间：**
    为生产和预览环境创建一个 KV 命名空间。
    ```bash
    # 创建生产环境的命名空间
    wrangler kv namespace create "EMOJI_BACKUP"

    # 创建预览环境的命名空间
    wrangler kv namespace create "EMOJI_BACKUP" --preview
    ```
    将生成的 ID 复制到 `wrangler.toml` 文件中，替换占位符值。

4.  **设置授权密钥：**
    为安全起见，授权令牌应设置为秘密（secret），而不是存储在 `wrangler.toml` 中。
    ```bash
    # 生成一个强密码
    # openssl rand -base64 32

    # 为生产环境设置密钥
    echo "你的秘密密码" | wrangler secret put AUTH_SECRET
    ```
    在本地开发中，密钥会从 `wrangler.toml` 的 `[vars]` 部分读取。

5.  **部署 Worker:**
    ```bash
    pnpm run deploy
    ```

## 在油猴脚本中使用

您必须在请求中包含 `Authorization` 请求头。

### 备份

```javascript
async function backupSettings(settings, authToken) {
  const response = await fetch('https://your-worker-url.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(settings),
  });

  if (response.ok) {
    console.log('备份成功');
  } else {
    console.error('备份失败：', await response.text());
  }
}
```

### 恢复

```javascript
async function restoreSettings(authToken) {
  const response = await fetch('https://your-worker-url.workers.dev/', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (response.ok) {
    const settings = await response.json();
    console.log('恢复成功', settings);
    return settings;
  } else {
    console.error('恢复失败：', await response.text());
    return null;
  }
}
```