# Cloudflare Worker for Userscript Backup

This worker provides a secure backup and restore service for the emoji extension's userscript version. It uses Cloudflare KV for storage and requires a secret token for authorization.

## API Endpoints

- `POST /`: Saves the request body to the KV store. Requires `Authorization` header.
- `GET /`: Retrieves the data from the KV store. Requires `Authorization` header.

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

4.  **Set the Authorization Secret:**
    For security, the authorization token should be set as a secret, not stored in `wrangler.toml`.
    ```bash
    # Generate a strong secret password
    # openssl rand -base64 32

    # Set the secret for the production environment
    echo "YOUR_SECRET_PASSWORD" | wrangler secret put AUTH_SECRET
    ```
    For local development, the secret is read from the `[vars]` section in `wrangler.toml`.

5.  **Deploy the Worker:**
    ```bash
    pnpm run deploy
    ```

## Usage in Userscript

You must include the `Authorization` header in your requests.

### Backup

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
    console.log('Backup successful');
  } else {
    console.error('Backup failed:', await response.text());
  }
}
```

### Restore

```javascript
async function restoreSettings(authToken) {
  const response = await fetch('https://your-worker-url.workers.dev/', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (response.ok) {
    const settings = await response.json();
    console.log('Restore successful', settings);
    return settings;
  } else {
    console.error('Restore failed:', await response.text());
    return null;
  }
}
```