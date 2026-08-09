# MCP Bridge (Streamable HTTP)

This extension exposes a local MCP server through Native Messaging when the
host is installed, and keeps the WebSocket server as a compatibility fallback.

## Overview

- Native host: `scripts/mcp-bridge/server.js`
- Default HTTP endpoint: `http://127.0.0.1:7465/mcp`
- MCP transport: Streamable HTTP (JSON-RPC POST, optional SSE response)
- Extension transport: Native Messaging first, WebSocket fallback

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
- Developer diagnostics: start/stop capture, console logs and network log (sensitive URL query values are redacted)
- DOM: dom_tree, dom_at_point
- Utility: wait

## Settings and discovery

Set the bridge transport to `auto` to try Native Messaging first. If the
native host is missing, the extension falls back to `pnpm mcp` and
`ws://127.0.0.1:7465/ws`. The settings page can probe the configured local
`/health` endpoint; this is local HTTP health discovery, not WebRTC/UDP P2P.
An extension cannot listen on arbitrary local sockets or perform pure P2P
discovery without a native host or a separate signaling service.

## Notes

- The native host is launched by Chrome when the extension connects. The
  extension sends the configured port before the host binds HTTP.
- For the standalone WebSocket server, change the port with `MCP_PORT`; the
  Native host receives the port from extension settings before binding.
- The bridge exposes browser automation tools (click, scroll, input, navigate, screenshot, tabs).
- Native Messaging stdout is reserved for framed protocol messages; diagnostics
  go to stderr so Chrome does not reject the host.
