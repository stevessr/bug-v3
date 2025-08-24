# Emoji Extension

A modern emoji extension built with Vue 3, Vite, and TypeScript featuring a progressive multi-layer storage system and compile-time optimization flags.

## Features

- 🎯 **Progressive Storage**: Multi-layer storage system with intelligent conflict resolution
- 📦 **Split Storage Architecture**: Individual emoji group storage for better performance
- 🔄 **Cross-Context Sync**: Real-time synchronization between popup, options, and content scripts
- 🎨 **Modern UI**: Built with Vue 3, Ant Design Vue, and Tailwind CSS
- 📱 **Touch Optimized**: Drag-and-drop support with mobile optimization
- 🔧 **Comprehensive Logging**: Detailed debugging and error tracking with compile-time toggles
- ☁️ **Cloud Sync**: Chrome sync storage support for configuration backup
- ⚡ **Build Optimization**: Compile-time flags for logging and IndexedDB to reduce bundle size

## Build Configurations

This project supports compile-time flags to optimize builds for different environments:

### Available Build Commands

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
```

### Bundle Size Comparison

| Build Type | Background.js | Content.js | Total Reduction |
| ---------- | ------------- | ---------- | --------------- |
| Standard   | 5.20 kB       | 23.03 kB   | Baseline        |
| Minimal    | 4.21 kB       | 19.50 kB   | ~15-40% smaller |

For detailed information about compile-time flags, see [BUILD_FLAGS.md](./BUILD_FLAGS.md).

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### Project Structure

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

## Release Process

### Automated Release (Recommended)

1. **Tag and Push**:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Automatic Actions**:
   - ✅ Builds extension
   - ✅ Creates GitHub release
   - ✅ Uploads to Microsoft Edge Store

### Manual Release

```bash
# Using the release script
npm run release 1.0.1

# Or manually
./scripts/release.sh 1.0.1
```

### Microsoft Edge Store Setup

For automated Edge Store uploads, see [Edge Store Setup Guide](.github/EDGE_STORE_SETUP.md).

## Storage Architecture

The extension uses a progressive multi-layer storage system:

```typescript
// Storage Priority Chain
1. Local Storage    (immediate access, 0ms)
2. Session Storage  (session-based, 100ms delay)
3. Extension Storage (Chrome API, 500ms delay)
4. IndexedDB       (persistent fallback, 1000ms delay)
```

### Key Features

- **Timestamp-based conflict resolution**: Newer data always wins
- **Split emoji storage**: Individual groups instead of monolithic storage
- **Progressive writes**: Timed writes across storage layers
- **Cross-context synchronization**: Real-time updates between all contexts

## Testing

### Playwright Tests

```bash
# Run all tests
npm run test

# Debug mode
npm run test:debug
```

### Manual Testing

1. Load unpacked extension in Chrome/Edge
2. Test popup functionality
3. Test options page
4. Test content script injection on websites
5. Verify cross-context synchronization

## Architecture

### Storage System

- **Primary**: IndexedDB for persistent local storage
- **Secondary**: Chrome storage for content script access
- **Backup**: Chrome sync storage with debouncing
- **Split Keys**: Individual group storage (`emojiGroup_{id}`)

### Components

- **Background Script**: Handles storage synchronization
- **Content Script**: Injects emoji picker into web pages
- **Popup**: Quick emoji access and favorites
- **Options**: Full emoji management and settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0

- Complete storage architecture rewrite
- Progressive multi-layer storage system
- Enhanced cross-context synchronization
- Split emoji group storage
- Automated release workflow
- Microsoft Edge Store integration
