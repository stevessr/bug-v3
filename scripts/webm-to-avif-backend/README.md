# WebM -> AVIF Backend (Node + ffmpeg)

Lightweight HTTP server to convert WebM files to animated AVIF using `ffmpeg`.

## Requirements

- Node.js 18+
- `ffmpeg` installed and available in `PATH`

## Run

```bash
node scripts/webm-to-avif-backend/server.js --port 8791
```

Optional limits:

```bash
node scripts/webm-to-avif-backend/server.js --port 8791 --max-bytes 52428800
```

## API

`POST /api/webm-to-avif`

- Body: raw WebM bytes
- Response: `image/avif`

Example:

```bash
curl -X POST \
  -H "Content-Type: video/webm" \
  --data-binary "@input.webm" \
  http://localhost:8791/api/webm-to-avif \
  -o output.avif
```
