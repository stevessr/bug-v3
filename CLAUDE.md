# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, feature-rich browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite, and TypeScript, it features a progressive multi-layer storage system, AI-powered features, and compile-time optimization flags.

## Key Features

- **Universal Emoji Picker**: Insert custom emojis on any website with a single click
- **Smart Organization**: Group emojis by category with drag-and-drop reordering
- **Quick Search**: Fast emoji search across all groups
- **Favorites System**: Mark frequently used emojis for quick access
- **AI-Powered Features**: AI naming using Google Gemini API, batch rename, duplicate detection using perceptual hashing
- **Synchronization**: Chrome sync, WebDAV support, and S3-compatible storage sync
- **Advanced Storage**: Progressive multi-layer storage system with intelligent data synchronization

## Architecture

### Storage System
The extension uses a sophisticated progressive multi-layer storage system with the following priority chain:
1. Local Storage - Immediate access (0ms latency)
2. Session Storage - Session-based cache (100ms delay)
3. Extension Storage - Chrome API storage (500ms delay)
4. IndexedDB - Persistent fallback (1000ms delay)

Key features include timestamp-based conflict resolution, split emoji storage (individual groups instead of monolithic storage), progressive writes with timed delays across layers, and cross-context synchronization with real-time updates.

### Core Components
- **Background Script** (`src/background/`): Service worker handling storage synchronization, browser events, and initialization
- **Content Scripts** (`src/content/`): Platform-specific injectors for Discourse, Bilibili, Pixiv, X/Twitter, Reddit, Xiaohongshu
- **Popup** (`src/popup/`): Quick emoji access interface with search and favorites
- **Options** (`src/options/`): Full emoji management interface with groups, settings, and AI features
- **State Management**: Uses Pinia with `useEmojiStore` managing emoji groups, settings, and favorites

### Build System
The project uses a sophisticated build system with multiple configurations:
- **Development**: Full features with logging and sourcemaps
- **Production**: Optimized build with optional logging removal
- **Minimal**: Smallest bundle without logging and IndexedDB
- **Userscript**: Tampermonkey/Violentmonkey compatible builds

Build flags are controlled via environment variables and compile-time defines in `vite.config.ts`.

## Development Commands

### Build Commands
```bash
# Development build (all features enabled)
npm run dev

# Standard production build (all features enabled)
npm run build

# Production build without logging (smaller bundle size)
npm run build:prod

# Build without IndexedDB support (for restricted environments)
npm run build:no-indexeddb

# Minimal build (no logging, no IndexedDB - smallest bundle)
npm run build:minimal

# Userscript builds (for Tampermonkey/Violentmonkey)
npm run build:userscript      # Build emoji picker and manager userscripts
npm run build:userscript:min  # Build minified userscripts

# Watch mode for development
npm run watch
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type check TypeScript
npm run type-check
```

### Testing
```bash
# Run all Playwright tests
npm run test

# Run tests in debug mode
npm run test:debug

# Run extension-specific tests
npm run test:extension

# Debug extension tests
npm run test:extension:debug
```

### Release and Packaging
```bash
# Create release with version tagging
npm run release

# Pack as CRX extension
npm run pack:crx

# Update deployment data
npm run update:data
```

## Key Source Files

### State Management
- `src/stores/emojiStore.ts`: Main Pinia store managing emoji groups, settings, favorites
- `src/utils/newStorage.ts`: Multi-layer storage system implementation
- `src/utils/syncConfigStorage.ts`: Synchronization configuration management

### Background Services
- `src/background/init.ts`: Extension initialization and default data setup
- `src/background/handlers/`: Event handlers for download, upload, sync, context menu
- `src/background/services/`: Core services for storage and sync operations

### Content Scripts (Platform Support)
- `src/content/discourse/`: Discourse forum integration
- `src/content/bilibili/`: Bilibili video platform support
- `src/content/pixiv/`: Pixiv art platform integration
- `src/content/x/`: X/Twitter support
- `src/content/reddit/`: Reddit integration
- `src/content/xhs/`: Xiaohongshu support

### Options Interface
- `src/options/pages/`: Main interface pages (Groups, Settings, AI Rename, etc.)
- `src/options/components/`: Reusable UI components
- `src/options/utils/`: Utility functions for import/export, formatting, etc.

### Userscript System
- `src/userscript/manager/`: Userscript-specific functionality
- `src/userscript/plugins/`: Plugin system for sync targets and features
- `src/userscript/modules/`: Core modules for userscript builds

## Development Notes

### Multi-Layer Storage Pattern
When working with storage, always use the `newStorageHelpers` from `src/utils/newStorage.ts`. This handles the progressive storage layers automatically and ensures data consistency across contexts.

### Cross-Context Communication
The extension uses Chrome runtime messaging for communication between background, content scripts, popup, and options. Store instances automatically handle message listener registration to avoid duplicates.

### Platform-Specific Content Scripts
Each platform has its own content script structure with detectors, UI injectors, and platform-specific utilities. When adding platform support, follow the existing patterns in `src/content/`.

### AI Features Integration
AI features are optional and depend on Google Gemini API configuration. The main AI functionality is in `src/options/pages/ai-rename/` and related utilities.

### Build Configuration
Build variants are controlled by environment variables in `scripts/build.js`. The build system supports conditional compilation for features like logging and IndexedDB support.