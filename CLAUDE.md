# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite (rolldown-vite), and TypeScript. Features a progressive multi-layer storage system, AI-powered naming via Google Gemini, and compile-time optimization flags.

## Build & Development

### Common Commands
```bash
pnpm install              # Install dependencies
pnpm dev               # Dev server (full features, logging enabled)
pnpm build             # Standard production build
pnpm build:debug       # No minification (for debugging)
pnpm lint              # Check linting
pnpm lint:fix          # Auto-fix lint issues
pnpm format            # Format with Prettier
pnpm type-check        # TypeScript type checking
pnpm update:data       # deploy scripts/cfworker
pnpm i <package>       # install package
```

### Testing (Playwright)
```bash
pnpm test                    # Run all tests
pnpm test:debug              # Debug mode
pnpm test:extension          # Extension-specific tests
pnpm test:extension:debug    # Debug extension tests
```

## Architecture

### Storage System (`src/utils/simpleStorage.ts`)
Simplified I/O layer directly wrapping `chrome.storage.local`.
- **Logic**: Pure I/O, no internal caching (caching handled by Pinia stores).
- **Usage**: Use `src/utils/simpleStorage.ts` for direct storage access, or Pinia stores for state management.

### Core Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Background | `src/background/` | Service worker, storage sync. Logic in `handlers/` (not `services/`) |
| Content Scripts | `src/content/` | Platform injectors: bilibili, discourse, pixiv, reddit, x, xhs |
| Popup | `src/popup/` | Quick emoji access with search/favorites |
| Options | `src/options/` | Main management UI. Pages in `src/options/pages/` |
| Sidebar | `src/sidebar/` | Sidebar quick access |

### State Management
- **Pinia** store at `src/stores/emojiStore.ts` manages emoji groups, settings, and favorites.

### Key Directories
- `src/services/` - Core business logic
- `src/config/` - Configuration constants
- `src/components/` - Shared Vue components
- `src/utils/` - Shared utilities (storage, sync, formatting)
- `src/types/` - TypeScript type definitions

## Development Notes

### Cross-Context Communication
Chrome runtime messaging between background, content scripts, popup, and options. Store instances handle message listener registration to avoid duplicates.

### AI Features
Optional Google Gemini API integration. Main AI functionality in `src/options/pages/ai-rename/`.

### Vue Components
Use Composition API with `<script setup>` syntax. Ant Design Vue for UI components.
