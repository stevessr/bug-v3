# Emoji Extension

A modern, feature-rich browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite, and TypeScript, featuring a progressive multi-layer storage system, AI-powered features, and compile-time optimization flags.

## ✨ Key Features

### 🎯 Core Functionality
- **Universal Emoji Picker**: Insert custom emojis on any website with a single click
- **Smart Organization**: Group emojis by category with drag-and-drop reordering
- **Quick Search**: Fast emoji search across all groups
- **Favorites System**: Mark frequently used emojis for quick access

### 🤖 AI-Powered Features
- **AI Naming**: Automatic emoji naming using Google Gemini API ([Details](./GEMINI_FEATURES.md))
- **Batch Rename**: Intelligently rename multiple emojis at once with AI assistance
- **Duplicate Detection**: Find similar emojis across groups using perceptual hashing
- **Smart References**: Reduce storage by referencing duplicate emojis instead of storing copies

### 🔄 Synchronization
- **Chrome Sync**: Automatic backup to Chrome sync storage
- **WebDAV Support**: Manual push/pull sync with any WebDAV server (Nextcloud, ownCloud, etc.)
- **S3 Compatible**: Sync with AWS S3, MinIO, Backblaze B2, and other S3-compatible storage
- **Multi-Device**: Keep your emojis in sync across all your devices ([Sync Guide](./SYNC_DOCUMENTATION.md))

### 🎨 User Experience
- **Modern UI**: Built with Vue 3, Ant Design Vue, and Tailwind CSS
- **Touch Optimized**: Responsive design with mobile support
- **Drag & Drop**: Intuitive emoji management with drag-and-drop
- **Lazy Loading**: Optimized performance for large emoji collections
- **Dark Mode**: (Future) Automatic theme switching

### 📦 Advanced Storage
- **Progressive Multi-Layer Storage**: Intelligent data synchronization across storage layers
- **Split Group Storage**: Individual storage for each group for better performance
- **Conflict Resolution**: Timestamp-based automatic conflict resolution
- **Cross-Context Sync**: Real-time updates between popup, options, and content scripts

### ⚡ Performance
- **Compile-Time Optimization**: Multiple build configurations for different use cases
- **Bundle Size Options**: Build with/without logging and IndexedDB support
- **Lazy Rendering**: Only render visible emojis for better performance
- **Image Lazy Loading**: Load images on demand to reduce initial load time

## 🚀 Quick Start

### Installation

#### From Chrome Web Store / Edge Add-ons
*(Coming soon)*

#### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/stevessr/bug-v3/releases)
2. Extract the ZIP file
3. Open your browser's extension page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Firefox: `about:addons`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

### Basic Usage

1. **Add Emojis**: Click the extension icon → Options → Add emojis via URL, batch import, or platform import
2. **Create Groups**: Organize your emojis into custom groups
3. **Use Emojis**: Click the extension icon or use the emoji picker on supported websites
4. **Sync Across Devices**: Configure WebDAV or S3 sync in Settings to keep emojis synchronized

## 📖 Documentation

- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Changelog](./CHANGELOG.md)** - Version history and release notes
- **[Permissions Guide](./PERMISSIONS.md)** - Explanation of required permissions
- **[Sync Documentation](./SYNC_DOCUMENTATION.md)** - WebDAV and S3 sync setup guide
- **[AI Features Guide](./GEMINI_FEATURES.md)** - Gemini API integration and AI features
- **[Build Flags](./scripts/docs/BUILD_FLAGS.md)** - Compile-time optimization options
- **[Documentation Index](./docs/README.md)** - Complete documentation index

## 🛠️ Development

### Prerequisites

- Node.js 18 or higher
- npm or pnpm package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/stevessr/bug-v3.git
cd bug-v3

# Install dependencies
npm install

# Start development server with hot-reloading
npm run dev
```

### Build Configurations

This project supports multiple build configurations optimized for different use cases:

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

Different build configurations offer different trade-offs:

| Build Type       | Logging | IndexedDB | Use Case                        |
| ---------------- | ------- | --------- | ------------------------------- |
| Development      | ✅      | ✅        | Development and debugging       |
| Standard         | ✅      | ✅        | General production use          |
| Production       | ❌      | ✅        | Production with smaller size    |
| Minimal          | ❌      | ❌        | Smallest bundle, basic features |

**Size Reduction**: Minimal build is approximately 15-40% smaller than standard build.

For detailed information about compile-time flags, see [BUILD_FLAGS.md](./scripts/docs/BUILD_FLAGS.md).

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

### Project Structure

```
src/
├── background/        # Service worker
├── content/          # Content scripts (injected into web pages)
├── popup/            # Extension popup UI
├── options/          # Options/settings page
├── shared/           # Shared utilities
│   ├── storage/      # Multi-layer storage system
│   └── stores/       # Pinia state stores
├── utils/            # Utility functions
└── assets/           # Static assets
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

## 🚀 Release Process

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

## 🏗️ Architecture

### Storage System

The extension uses a sophisticated progressive multi-layer storage system:

**Storage Priority Chain:**
1. **Local Storage** - Immediate access (0ms latency)
2. **Session Storage** - Session-based cache (100ms delay)
3. **Extension Storage** - Chrome API storage (500ms delay)
4. **IndexedDB** - Persistent fallback (1000ms delay)

**Key Features:**
- Timestamp-based conflict resolution (newer data wins)
- Split emoji storage (individual groups instead of monolithic storage)
- Progressive writes with timed delays across layers
- Cross-context synchronization with real-time updates

### State Management

- **Pinia**: Modern Vue state management
- **useEmojiStore**: Main store managing emoji groups, settings, and favorites
- **Cross-Context Sync**: Real-time updates between popup, options, and content scripts

### Components

- **Background Script**: Handles storage synchronization and browser events
- **Content Script**: Injects emoji picker into web pages
- **Popup**: Quick emoji access interface
- **Options**: Full emoji management and settings

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for detailed information on:

- Setting up the development environment
- Code style and standards
- Testing requirements
- Pull request process
- Reporting issues

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our [code standards](./CONTRIBUTING.md#coding-standards)
4. Run tests and linting (`npm run lint && npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

This project is licensed under GPL-3.0 with additional attribution requirements. See [LICENSE.md](./LICENSE.md) for details.

Key points:
- Free to use, modify, and distribute
- Attribution to original source required
- Derivative works must also be GPL-3.0
- Can be published to Chrome/Edge stores with attribution

## 🙏 Acknowledgments

- Built with [Vue 3](https://vuejs.org/)
- UI components from [Ant Design Vue](https://antdv.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- AI features powered by [Google Gemini API](https://ai.google.dev/)
- Build system using [Vite](https://vitejs.dev/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/stevessr/bug-v3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/stevessr/bug-v3/discussions)
- **Documentation**: See [Documentation](#-documentation) section above

## 🗺️ Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox Add-ons support
- [ ] Dark mode support
- [ ] Additional AI features (smart grouping, auto-tagging)
- [ ] Cloud sync with Google Drive and Dropbox
- [ ] Performance optimizations for very large collections (10,000+ emojis)
- [ ] Mobile app companion

---

**Star ⭐ this repository if you find it useful!**
