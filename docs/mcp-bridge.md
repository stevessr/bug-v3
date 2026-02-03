# MCP Bridge (Streamable HTTP)

This extension can expose a local MCP server via a native messaging bridge.

## Overview

- Native host: `scripts/mcp-bridge/server.js`
- Default HTTP endpoint: `http://127.0.0.1:7465/mcp`
- Transport: streamable-http (single endpoint)

## Install steps

1. Build/install the extension and note its extension ID.
2. Make the host executable:

```bash
chmod +x scripts/mcp-bridge/server.js
```

3. Generate a native host manifest:

```bash
node scripts/mcp-bridge/create-host-manifest.js \
  --extension-id <your-extension-id> \
  --host-path "/absolute/path/to/scripts/mcp-bridge/server.js"
```

4. Install the manifest file for your OS.

- **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- **Linux**: `~/.config/google-chrome/NativeMessagingHosts/`
- **Windows**: create a registry entry pointing to the manifest.

The output file is `scripts/mcp-bridge/host-manifest.json` by default.

## Tools exposed

- Tabs: list, get active, activate, create, close, reload, back, forward, duplicate, move, pin, unpin, mute, unmute, highlight, zoom, group, ungroup
- Windows: list, get, current, create, update, close
- Navigation: navigate
- Pointer: click, double-click, right-click, hover, focus, blur
- Input: input, type, key, select
- Motion: scroll, drag
- Media: screenshot
- DOM: dom_tree, dom_at_point
- Utility: wait

## Notes

- The native host is launched by Chrome when the extension connects.
- Change the server port with `MCP_PORT` env var if needed.
- The bridge exposes browser automation tools (click, scroll, input, navigate, screenshot, tabs).
