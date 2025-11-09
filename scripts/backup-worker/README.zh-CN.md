# 用于油猴脚本备份的 Cloudflare Worker

该 Worker 为表情扩展的油猴脚本版本提供了一个安全的备份和恢复服务。它使用 Cloudflare KV 进行存储，并需要一个秘密令牌进行授权。为了增强安全性，它同时支持读写和只读两种令牌。

## API 端点

- `POST /:key`: 将请求体保存到 KV 存储中（键为 `:key`）。需要读写令牌。
- `GET /`: 列出 KV 命名空间中的所有键。需要只读或读写令牌。
- `GET /:key`: 检索指定键的数据。需要只读或读写令牌。
- `DELETE /:key`: 删除指定的键及其数据。需要读写令牌。

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
    为安全起见，授权令牌应设置为秘密（secret），而不是存储在 `wrangler.toml` 中。您应该生成两个唯一的强密码。

    ```bash
    # 生成强密码
    # openssl rand -base64 32
    # openssl rand -base64 32

    # 为生产环境设置读写密钥
    echo "你的读写密码" | wrangler secret put AUTH_SECRET

    # 为生产环境设置只读密钥
    echo "你的只读密码" | wrangler secret put AUTH_SECRET_READONLY
    ```

    在本地开发中，密钥会从 `wrangler.toml` 的 `[vars]` 部分读取。

5.  **部署 Worker:**
    ```bash
    pnpm run deploy
    ```

## 在油猴脚本中使用

您必须在请求中包含 `Authorization` 请求头。推送（备份）操作请使用读写令牌，拉取（恢复）操作建议使用只读令牌（如果已配置）。
