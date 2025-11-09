# Cloudflare Worker for Userscript Backup

This worker provides a secure backup and restore service for the emoji extension's userscript version. It uses Cloudflare KV for storage and requires a secret token for authorization. It supports both a read-write and a read-only token for enhanced security.

## API Endpoints

- `POST /:key`: Saves the request body to the KV store under the specified `key`. Requires read-write token.
- `GET /`: Lists all keys in the KV namespace. Requires read-only or read-write token.
- `GET /:key`: Retrieves the data for the specified `key`. Requires read-only or read-write token.
- `DELETE /:key`: Deletes the specified `key` and its data. Requires read-write token.

## Setup and Deployment

1.  **Install Dependencies:**

    ```bash
    # Navigate to this directory
    cd scripts/backup-worker

    # Install wrangler
    pnpm install
    ```

2.  **Configure `wrangler.toml`:**
    Open `wrangler.toml` and add your Cloudflare `account_id`.

3.  **Create a KV Namespace:**
    Create a KV namespace for production and preview environments.

    ```bash
    # Create a production namespace
    wrangler kv namespace create "EMOJI_BACKUP"

    # Create a preview namespace
    wrangler kv namespace create "EMOJI_BACKUP" --preview
    ```

    Copy the generated IDs into `wrangler.toml`, replacing the placeholder values.

4.  **Set the Authorization Secrets:**
    For security, the authorization tokens should be set as secrets, not stored in `wrangler.toml`. You should generate two strong, unique passwords.

    ```bash
    # Generate strong secret passwords
    # openssl rand -base64 32
    # openssl rand -base64 32

    # Set the read-write secret for the production environment
    echo "YOUR_READ_WRITE_PASSWORD" | wrangler secret put AUTH_SECRET

    # Set the read-only secret for the production environment
    echo "YOUR_READ_ONLY_PASSWORD" | wrangler secret put AUTH_SECRET_READONLY
    ```

    For local development, the secrets are read from the `[vars]` section in `wrangler.toml`.

5.  **Deploy the Worker:**
    ```bash
    pnpm run deploy
    ```

## Usage in Userscript

You must include the `Authorization` header in your requests. Use the read-write token for push operations and the read-only token (if configured) for pull operations.
