# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser extension for managing custom emojis across websites.

Core stack:

- Vue 3 + TypeScript + Pinia
- Ant Design Vue + Tailwind CSS
- Vite 8 (Rolldown) with custom Node build scripts
- Playwright for E2E tests (regular + extension-specific)

The codebase runs in multiple extension contexts: background service worker, content scripts, popup/options/sidebar UIs, plus a standalone Discourse entry.

## Common Commands

```bash
pnpm install

# Development / build (all dispatch through scripts/build.js)
pnpm dev                  # build.js dev — full features, logging on
pnpm watch                # watches src/, triggers build:debug on change (500ms debounce)
pnpm build                # standard build, logging off
pnpm build:prod           # production build, terser minifier
pnpm build:debug          # non-minified + sourcemap-friendly + logging on
pnpm build:minimal        # BUILD_FAST=true, skips slow plugins/splitting

pnpm serve                # vite preview on :4173 (used by Playwright)

# Quality checks
pnpm lint                 # eslint over .vue/.js/.ts/.jsx/.tsx
pnpm lint:fix
pnpm format               # prettier --write
pnpm format:check
pnpm type-check           # vue-tsc --noEmit
pnpm check:all            # lint + format:check + type-check

# Tests
pnpm test                                                # regular Playwright suite
pnpm test -- scripts/tests/<file>.spec.ts                # single file
pnpm test -- -g "<test name>"                            # by name pattern
pnpm test:debug

pnpm test:extension                                       # extension suite (loads dist/)
pnpm test:extension -- scripts/tests/extension/<file>.spec.ts
pnpm test:extension:debug
```

Notes:

- Extension tests load the built extension from `dist/`, so run `pnpm build` first when needed.
- Packaging/release scripts live in `package.json` (`pack:crx`/`pack:xpi`/`pack:zip`, `release`, `update:*`).
- `pnpm dev` and any build can take `--no-browser` (or env `npm_config_no_browser=true`) to disable the forum browser entry — see Build Flags below.

## Build Flags / Env Vars

`scripts/build.js` sets env vars based on the build name, then `vite.config.ts` reads them. Override flags by setting env vars in front of any command.

- `ENABLE_LOGGING` — keeps `logger.*` calls (`@/utils/logger`). Forced off in non-dev builds unless `dev` or `build:debug`.
- `ENABLE_FORUM_BROWSER` — adds `discourse.html` as a build input and keeps the Discourse browser UI. When false, vite aliases swap in `NoForumBrowserPage.vue` / `NoForumBrowser.vue`.
- `ENABLE_LOCAL_MCP_BRIDGE` — when false, vite aliases swap `src/background/handlers/mcpBridge.ts` → `mcpBridge.disabled.ts`.
- `BUILD_FAST=true` — skips source maps, `auto-imports.d.ts` / `components.d.ts` generation, code splitting, and CSS minify.
- `BUILD_MINIFIED=false` — keeps the bundle unminified (used by `build:debug`).
- `BUILD_MINIFIER=terser` — switches from default oxc minifier to terser (used by `build:prod`).
- `BUILD_SOURCEMAP=true`, `BUILD_MANIFEST=true` — optional outputs.

Passing `--no-browser` to `scripts/build.js` sets both `ENABLE_FORUM_BROWSER=false` and `ENABLE_LOCAL_MCP_BRIDGE=false`. See `scripts/docs/BUILD_FLAGS.md` for narrative docs (some details may pre-date the recent flag rename).

## High-Level Architecture

### Path alias

- `@` → `src/` (configured in `vite.config.ts`). Always prefer `@/...` over relative `../../...`.

### Auto-imports (silent globals)

`unplugin-auto-import` and `unplugin-vue-components` are configured in `vite.config.ts`. The following are usable **without explicit imports** in source files:

- Vue Composition API: `ref`, `computed`, `watch`, `onMounted`, etc.
- Vue Router: `useRoute`, `useRouter`.
- Pinia helpers.
- Ant Design `message`.
- All stores from `src/stores/index.ts`: `useGroupStore`, `useEmojiCrudStore`, `useFavoritesStore`, `useCssStore`, `useEmojiStore`, `useSyncStore`, `useTagStore`.
- Composables/utils in `src/composables/` and `src/utils/` (entire dirs are scanned).
- Ant Design Vue components and `@ant-design/icons-vue` icons matching `[A-Z][a-z]+...(Outlined|Filled|TwoTone)`.

Type definitions land in `src/auto-imports.d.ts` and `src/components.d.ts` — these are generated; don't hand-edit.

A custom vite plugin in `vite.config.ts` (`ANTD_IMPORT_TRANSFORM_MAP`) also rewrites named imports from `ant-design-vue` into per-component `ant-design-vue/es/<path>` imports for tree-shaking.

### Runtime Entrypoints

- `index.html` → `src/main.ts`: main extension UI bootstrap (Pinia + router + App mount). Used by popup / options / sidebar.
- `src/App.vue`: selects which mode component to render based on URL params:
  - `?tabs=<route>` (without `type=sidebar`) **forces options mode** and navigates the router to the given path; this overrides any `type=popup`.
  - `?type=options|popup|sidebar` otherwise; default is `popup`.
  - The mode is also reflected via a `options-mode`/`popup-mode`/`sidebar-mode` class on `<body>` for styling.
- `discourse.html` → `src/discourse.ts`: standalone Discourse browser mount (only built when `ENABLE_FORUM_BROWSER=true`).
- `src/background/background.ts`: background service worker entry. Wires `setupOnInstalledListener`, `setupMessageListener`, `setupStorageChangeListener`, `setupContextMenu`, `setupPeriodicCleanup`, `setupMcpBridge`, `setupScheduledLikes`, `setupScheduledBrowse` — all imported from `src/background/utils/handlers.ts`.
- `src/content/content.ts`: content-script entry. Detects platform via `utils/core/platformDetector`, statically initializes Discourse features when applicable, dynamically `import()`s other platform modules via `utils/core/platformLoader`.

### State + Storage

- Pinia stores live under `src/stores/`. **`src/stores/index.ts` is the canonical re-export hub** — prefer importing from `@/stores` over individual files. Sub-stores: `groupStore`, `emojiCrudStore`, `favoritesStore`, `tagStore`, `syncStore`, `cssStore`, `searchIndexStore`, `tagCountStore`. The legacy umbrella store `emojiStore.ts` is still the primary entry point for many components.
- Cross-context (popup ↔ options ↔ content ↔ background) sync logic: `src/stores/core/useStorageSync.ts`.
- Storage I/O and keys are centralized in `src/utils/simpleStorage.ts`. Higher-level sync targets (WebDAV, S3) are in `src/utils/syncTargets.ts` and `src/utils/cloudflareSync.ts`.

### Messaging Between Contexts

- Canonical message/type definitions: `src/types/messages.ts`.
- Background handler registration: `src/background/utils/handlers.ts` (calls into one-handler-per-file modules under `src/background/handlers/`, e.g. `handleProxyImageRequest.ts`, `handleAddToFavorites.ts`).
- Content-side dispatcher: `src/content/messageHandlers/index.ts`.
- When adding a message type: update `src/types/messages.ts`, add/extend the handler under `src/background/handlers/`, register it in `utils/handlers.ts`, and update the content dispatcher if relevant.

### Content Script — Multi-Platform

Content script supports several platforms; only Discourse is statically loaded. Each platform has its own folder under `src/content/`:

- `discourse/` — emoji injection, post timings binder, auto-read replies, like counter, seeking, credit, etc.
- `bilibili/`, `pixiv/`, `reddit/`, `tieba/`, `x/` (Twitter), `xhs/` (Xiaohongshu).
- Shared utilities: `src/content/utils/{core,picker,dom,upload,injector,ui,...}`.
- The detector decides whether to load the emoji feature (Discourse-style forums) and/or a platform-specific module.

### Discourse Feature Area (in-app browser)

- UI modules: `src/options/components/discourse/`.
- Route loaders (home/categories/tags/bookmarks/etc.): `src/options/components/discourse/routes/root.ts`.
- API action exports are centralized in `src/options/components/discourse/actions/index.ts`.
- The whole feature is gated by `ENABLE_FORUM_BROWSER`.

### Agent / MCP Bridge

- Agent module: `src/agent/`. Contains its own runtime, types, memory, skills, MCP client/UI, retry, streaming, thread management, etc. Entry types: `src/agent/types.ts`; module index: `src/agent/index.ts`.
- MCP background bridge (websocket): `src/background/handlers/mcpBridge.ts`. Handles WS/WSS auto-upgrade, heartbeat, reconnect, tool dispatch. Replaced at build time by `mcpBridge.disabled.ts` when the local MCP bridge is disabled.
- MCP app sandbox UI renderer: `src/options/components/McpAppViewer.vue`.

## Build/Test Behavior To Preserve

- `scripts/build.js`
  - Switches build variant via `dev` / `build` / `build:prod` / `build:minimal` / `build:debug` arg.
  - Supports `--no-browser` (or `npm_config_no_browser=true`) to disable forum browser + MCP bridge in one shot.
  - Auto-detects `pnpm` vs `npm`.
  - Copies WASM assets from `scripts/wasm/` → `public/wasm/` before invoking vite. Currently copies `perceptual_hash.js` and `perceptual_hash.wasm`.
- `scripts/watch.js`
  - Watches `src/` recursively, respects `.gitignore`, filters by extension whitelist, debounces 500ms, runs `build:debug`. Queues at most one pending rebuild while another is in flight.
- `playwright.config.ts`
  - Test dir `scripts/tests`, runs against preview server (`pnpm serve`) on `:4173`.
- `playwright.extension.config.ts`
  - Test dir `scripts/tests/extension`, headed + single worker (extensions can't run in parallel), loads extension from `dist/` via `--load-extension`.

## Contributing Conventions (from CONTRIBUTING.md)

- Branch prefixes commonly used: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- Commit prefixes used in this repo: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
- For UI changes, include screenshots in PRs.

## Related Docs

- Build flags: `scripts/docs/BUILD_FLAGS.md`
- Sync behavior: `SYNC_DOCUMENTATION.md`
- Gemini features: `GEMINI_FEATURES.md`
- Auto-download migration: `AUTODOWNLOAD_MIGRATION.md`
- Contribution process: `CONTRIBUTING.md`
- Wider docs index: `docs/README.md`
