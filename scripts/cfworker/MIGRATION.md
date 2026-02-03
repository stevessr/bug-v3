# Backup Worker Migration

## Overview

The standalone `backup-worker` has been successfully merged into the `cfworker` project as a Cloudflare Pages Function.

## Changes Made

### 1. Created New Function

**Location**: `functions/api/backup/[[key]].ts`

This new Cloudflare Pages Function replaces the standalone Worker. Key differences:

- Uses Pages Function format (`export const onRequest: PagesFunction<Env>`) instead of Worker format (`export default { async fetch() }`)
- Uses catch-all route `[[key]]` for dynamic routing instead of URL pathname parsing
- All authentication, CORS, and KV storage logic preserved

### 2. Updated Documentation

**File**: `README.md`

Added comprehensive documentation for the backup API:

- API endpoint documentation
- Authentication requirements
- Example curl commands
- Deployment instructions

### 3. Configuration

**File**: `wrangler.toml`

The existing configuration already includes:

- KV namespace binding (`EMOJI_BACKUP`)
- Development environment variables (`AUTH_SECRET`, `AUTH_SECRET_READONLY`)

## Migration Details

### ⚠️ API Path Change

The API path has changed from the root to `/api/backup`:

**Old (standalone worker)**:

- `https://your-worker.workers.dev/` → List keys
- `https://your-worker.workers.dev/user123` → Get/Set/Delete key

**New (Pages Function)**:

- `https://your-pages.pages.dev/api/backup` → List keys
- `https://your-pages.pages.dev/api/backup/user123` → Get/Set/Delete key

### API Compatibility

All API operations remain the same, only the base path changed:

- `GET /api/backup` - List all backup keys
- `GET /api/backup/:key` - Get specific backup
- `POST /api/backup/:key` - Save backup (write token required)
- `DELETE /api/backup/:key` - Delete backup (write token required)

### Authentication

Same authentication mechanism:

- Read-only token: `AUTH_SECRET_READONLY`
- Read-write token: `AUTH_SECRET`
- Format: `Authorization: Bearer <token>`

### Storage

Uses the same KV namespace (`EMOJI_BACKUP`)

## Deployment

### First-time Setup

```bash
cd scripts/cfworker

# Create KV namespaces (if not already created)
npx wrangler kv:namespace create "EMOJI_BACKUP"
npx wrangler kv:namespace create "EMOJI_BACKUP" --preview

# Update wrangler.toml with the namespace IDs returned above

# Set secrets for production
npx wrangler pages secret put AUTH_SECRET --project-name=your-project
npx wrangler pages secret put AUTH_SECRET_READONLY --project-name=your-project
```

### Deploy

```bash
cd scripts/cfworker
npx wrangler pages deploy public
```

### Local Testing

```bash
cd scripts/cfworker
npm run dev

# Test the API
curl -H "Authorization: Bearer dev-secret-password-readonly" \
  http://localhost:8788/api/backup
```

## What's Next?

### Optional: Remove Old Worker

The `scripts/backup-worker` directory can now be safely removed:

```bash
rm -rf scripts/backup-worker
```

### Update Extension Configuration

If you were using the standalone backup-worker:

1. Deploy the new Pages Function
2. **Update the URL in your extension settings**:
   - Old: `https://your-worker.workers.dev`
   - New: `https://your-pages-project.pages.dev/api/backup`
3. Test the connection in the extension's sync settings
4. Delete the old Worker deployment (optional)

**Important**: The client code in `src/utils/syncTargets.ts` has been updated to work with the new `/api/backup` path. After rebuilding the extension, users need to update their Worker URL to include `/api/backup`.

## Benefits of Migration

1. **Unified Deployment**: Both video2gif and backup API served from one Pages project
2. **Simplified Maintenance**: One codebase, one deployment process
3. **Cost Efficiency**: Pages Functions included in Pages free tier
4. **Better Organization**: Functions organized under `/functions/api/` directory

## Technical Notes

### Catch-all Route

The `[[key]]` syntax in the filename creates a catch-all route. The parameter is accessed as an array:

```typescript
const keyArray = params.key as string[] | undefined
const key = keyArray && keyArray.length > 0 ? keyArray.join('/') : ''
```

This allows:

- `/api/backup` → `key = ''` (empty, triggers list operation)
- `/api/backup/user123` → `key = 'user123'`
- `/api/backup/path/to/key` → `key = 'path/to/key'`

### Environment Variables

For local development, `wrangler.toml` provides fallback values:

```toml
[vars]
AUTH_SECRET = "dev-secret-password"
AUTH_SECRET_READONLY = "dev-secret-password-readonly"
```

For production, use `wrangler pages secret put` to set secure values.
