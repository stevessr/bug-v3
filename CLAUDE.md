# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, feature-rich browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite, and TypeScript, it features a progressive multi-layer storage system, AI-powered features, and compile-time optimization flags.

## Build & Development

### Common Commands
- **Install Dependencies**: `pnpm install`
- **Dev Server**: `npm run dev` (Full features, logging enabled)
- **Production Build**: `npm run build`
- **Debug Build**: `npm run build:debug` (No minification)
- **Userscript Build**: `npm run build:userscript`
- **Lint**: `npm run lint`
- **Fix Lint**: `npm run lint:fix`
- **Format**: `npm run format`
- **Type Check**: `npm run type-check`

### Testing
- **Run All Tests**: `npm run test` (Playwright)
- **Debug Tests**: `npm run test:debug`
- **Extension Tests**: `npm run test:extension`

## Architecture

### Storage System
The extension uses a sophisticated progressive multi-layer storage system (`src/utils/newStorage.ts`) with the following priority chain:
1. **Local Storage**: Immediate access (0ms latency)
2. **Session Storage**: Session-based cache (100ms delay)
3. **Extension Storage**: Chrome API storage (500ms delay)
4. **IndexedDB**: Persistent fallback (1000ms delay)

*Always use `newStorageHelpers` for data access to maintain consistency.*

### Core Components
- **Background** (`src/background/`): Service worker handling storage synchronization and browser events. Note: `src/background/services/` is currently empty; logic resides in `handlers/`.
- **Content Scripts** (`src/content/`): Platform-specific injectors (Discourse, Bilibili, Pixiv, X/Twitter, Reddit, Xiaohongshu).
- **Popup** (`src/popup/`): Quick emoji access interface with search and favorites.
- **Options** (`src/options/`): Main management interface.
  - Pages located in `src/options/pages/` (Groups, Settings, AI Rename, Tag Management, Stats, Buffer).
- **Sidebar** (`src/sidebar/`): Sidebar component for quick access.
- **Userscript** (`src/userscript/`): Standalone userscript implementation.
  - `manager/`: Management interface
  - `modules/`: Core functionality
  - `plugins/`: Plugin system for sync targets

### State Management
- **Pinia**: Used for global state (`src/stores/`).
- **`emojiStore.ts`**: Manages emoji groups, settings, and favorites.

### Key Directories
- `src/services/`: Core business logic and service implementations.
- `src/config/`: Configuration constants and defaults.
- `src/components/`: Shared Vue components (e.g., `ConflictResolver.vue`).
- `src/utils/`: Shared utilities (storage, sync, formatting).

## Technology Stack
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Less
- **UI Component Library**: Ant Design Vue
- **Build Tool**: Vite (with custom scripts in `scripts/`)

## Development Notes

### Multi-Layer Storage Pattern
When working with storage, always use the `newStorageHelpers` from `src/utils/newStorage.ts`. This handles the progressive storage layers automatically and ensures data consistency across contexts.

### Cross-Context Communication
The extension uses Chrome runtime messaging for communication between background, content scripts, popup, and options. Store instances automatically handle message listener registration to avoid duplicates.

### AI Features Integration
AI features are optional and depend on Google Gemini API configuration. The main AI functionality is in `src/options/pages/ai-rename/` and related utilities.
