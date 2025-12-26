# Emoji Extension - Qwen Context

## Project Overview

This is a modern emoji extension built with Vue 3, Vite, and TypeScript. It features a progressive multi-layer storage system and compile-time optimization flags. The extension provides emoji picker and management functionality for web browsers, particularly optimized for Discourse forums.

## Key Features

- **Progressive Storage**: Multi-layer storage system with intelligent conflict resolution (Local Storage → Session Storage → Extension Storage → IndexedDB)
- **Split Storage Architecture**: Individual emoji group storage for better performance
- **Cross-Context Sync**: Real-time synchronization between popup, options, and content scripts
- **Modern UI**: Built with Vue 3, Ant Design Vue, and Tailwind CSS
- **Touch Optimized**: Drag-and-drop support with mobile optimization
- **Comprehensive Logging**: Detailed debugging and error tracking with compile-time toggles
- **Cloud Sync**: Chrome sync storage support for configuration backup
- **WebDAV & S3 Sync**: Manual push/pull synchronization with WebDAV and S3-compatible storage
- **Build Optimization**: Compile-time flags for logging and IndexedDB to reduce bundle size

## Project Architecture

### Directory Structure
```
src/
├── background/     # Service worker
├── content/        # Content scripts
├── popup/          # Extension popup
├── options/        # Options page
├── shared/         # Shared utilities
│   ├── storage/    # Storage system
│   └── stores/     # Pinia stores
└── assets/         # Static assets
```

### Core Components
- **Background Script**: Handles storage synchronization
- **Content Script**: Injects emoji picker into web pages
- **Popup**: Quick emoji access and favorites
- **Options**: Full emoji management and settings

### Storage System
The extension uses a sophisticated progressive multi-layer storage system:
1. Local Storage (immediate access, 0ms)
2. Session Storage (session-based, 100ms delay)
3. Extension Storage (Chrome API, 500ms delay)
4. IndexedDB (persistent fallback, 1000ms delay)

With conflict resolution based on timestamps (newer data wins).

### State Management
Uses Pinia for state management with `useEmojiStore` as the main store that manages:
- Emoji groups and emojis
- User settings
- Favorites
- Active group and search functionality

## Building and Running

### Prerequisites
- Node.js 18+
- pnpm (preferred) or npm

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm run test
```

### Build Configurations

The project supports multiple build types with compile-time flags:

```bash
# Development build (all features enabled)
pnpm run dev

# Standard production build (all features enabled)
pnpm run build

# Production build without logging (smaller bundle size)
pnpm run build:prod

# Build without IndexedDB support (for restricted environments)
pnpm run build:no-indexeddb

# Minimal build (no logging, no IndexedDB - smallest bundle)
pnpm run build:minimal

```


## Development Conventions

### TypeScript
- Strict TypeScript configuration
- Type definitions for Chrome APIs included
- Path aliases using `@/*` mapping to `src/*`

### Vue 3 Composition API
- Uses Composition API with `<script setup>` syntax
- Pinia for state management
- Vue Router for navigation

### Code Quality
- ESLint with custom rules
- Prettier for code formatting
- Type checking with vue-tsc

### Storage Patterns
- Progressive writes with timed delays
- Conflict resolution with timestamp-based logic
- Cross-context synchronization with debounced updates

## Testing

### Playwright Tests
```bash
# Run all tests
pnpm run test

# Debug mode
pnpm run test:debug

# Extension-specific tests
pnpm run test:extension
pnpm run test:extension:debug
```

## Deployment

### Automated Release (Recommended)
1. Tag and push:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. Automatic actions:
   - Builds extension
   - Creates GitHub release
   - Uploads to Microsoft Edge Store

### Manual Release
```bash
# Using the release script
pnpm run release 1.0.1

# Or manually
./scripts/release.sh 1.0.1
```

## Special Considerations

1. **Logging Control**: Can be toggled at compile time using `__ENABLE_LOGGING__` flag
2. **Bundle Optimization**: Different builds for different needs (minimal, production, debug)
3. **Cross-Context Communication**: Uses Chrome runtime messaging for synchronization
4. **Security**: Includes image URL normalization and content security validation
5. **Sync Storage**: Chunked storage for large data sets to comply with sync storage limits

## Configuration Files

- `vite.config.ts` - Vite build configuration with compile-time flag definitions
- `tsconfig.json` - TypeScript configuration with path aliases
- `package.json` - Dependencies, scripts, and project metadata
- `playwright.config.ts` - Playwright testing configuration

The project is well-structured with a focus on performance, maintainability, and user experience across different contexts.