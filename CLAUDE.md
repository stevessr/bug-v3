# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser extension for managing custom emojis across websites.

Core stack:
- Vue 3 + TypeScript + Pinia
- Ant Design Vue + Tailwind CSS
- Vite (via `rolldown-vite`) with custom Node build scripts
- Playwright for E2E tests (regular + extension-specific)

The codebase runs in multiple extension contexts: background service worker, content scripts, popup/options/sidebar UIs, plus a standalone Discourse entry.

## Common Commands

```bash
pnpm install

# Development / build
pnpm dev                  # scripts/build.js dev
pnpm watch                # watch src/ and trigger build:debug
pnpm build                # standard production build
pnpm build:prod           # production build variant
pnpm build:debug          # non-minified debug build
pnpm build:minimal        # minimal build variant
pnpm serve                # preview dist on :4173

# Quality checks
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm type-check
pnpm check:all

# Tests
pnpm test
pnpm test -- scripts/tests/<file>.spec.ts
pnpm test -- -g "<test name>"
pnpm test:debug

pnpm test:extension
pnpm test:extension -- scripts/tests/extension/<file>.spec.ts
pnpm test:extension:debug
```

Notes:
- Extension Playwright tests load from `dist/`, so run `pnpm build` first when needed.
- Packaging/release scripts are in `package.json` (`pack:*`, `release`, `update:*`).

## High-Level Architecture

### Runtime Entrypoints
- `src/main.ts`: main extension UI bootstrap (Pinia + router + App mount).
- `src/App.vue`: selects `popup` / `options` / `sidebar` mode by URL params (`type`, `tabs`).
- `src/discourse.ts`: standalone Discourse browser mount.
- `src/background/background.ts`: background startup; wires listeners, jobs, MCP bridge.
- `src/content/content.ts`: content-script entry; platform detection + dynamic module loading.

### State + Storage
- Main app state lives in Pinia (`src/stores/emojiStore.ts`).
- Cross-context synchronization logic is in `src/stores/core/useStorageSync.ts`.
- Storage I/O and keys are centralized in `src/utils/simpleStorage.ts`.

### Messaging Between Contexts
- Canonical message/type definitions: `src/types/messages.ts`.
- Background handler wiring: `src/background/utils/handlers.ts`.
- Content-side dispatcher: `src/content/messageHandlers/index.ts`.
- When adding a message type, update both type definitions and both routing sides.

### Discourse Feature Area
- Main UI modules are in `src/options/components/discourse/`.
- Route loaders (home/categories/tags/bookmarks/etc.) are in `routes/root.ts`.
- API action exports are centralized in `actions/index.ts`.

### MCP / Agent Bridge
- Agent and MCP-related types: `src/agent/types.ts`.
- Bridge connection/tool execution: `src/background/handlers/mcpBridge.ts`.
  - Includes WS/WSS auto protocol handling, heartbeat, reconnect, and tool dispatch.
- MCP app sandbox UI renderer: `src/options/components/McpAppViewer.vue`.

## Build/Test Behavior To Preserve

- `scripts/build.js`
  - Controls build variants via env flags.
  - Copies WASM assets from `scripts/wasm/` into `public/wasm/` before dev/build.
- `scripts/watch.js`
  - Watches `src/` with debounce and triggers `build:debug`.
- `playwright.config.ts`
  - Uses `scripts/tests`, runs against preview server (`pnpm serve`) on `:4173`.
- `playwright.extension.config.ts`
  - Uses `scripts/tests/extension`, runs headed + single worker, loads extension from `dist/`.

## Contributing Conventions (from CONTRIBUTING.md)

- Branch prefixes commonly used: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- Commit prefixes used in this repo: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
- For UI changes, include screenshots in PRs.

## Related Docs

- Build flags: `scripts/docs/BUILD_FLAGS.md`
- Sync behavior: `SYNC_DOCUMENTATION.md`
- Gemini features: `GEMINI_FEATURES.md`
- Contribution process: `CONTRIBUTING.md`
