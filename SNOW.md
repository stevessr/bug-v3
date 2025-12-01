# Emoji Extension

A modern, feature-rich browser extension for managing and using custom emojis across the web.

## Overview

The **Emoji Extension** is a comprehensive browser extension that enables users to manage, organize, and insert custom emojis across virtually any website. Built with modern web technologies (Vue 3, Vite, TypeScript), the extension features a sophisticated progressive multi-layer storage system, AI-powered naming capabilities, and advanced synchronization options across devices. The project supports multiple deployment targets including Chrome/Edge extensions, Firefox add-ons, and userscripts for Tampermonkey/Violentmonkey.

The extension specializes in intelligent emoji management with features like duplicate detection using perceptual hashing, batch operations with AI assistance, and seamless synchronization across multiple devices via WebDAV or S3-compatible storage providers.

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.9.3
- **Framework**: Vue 3.5.24
- **State Management**: Pinia 2.3.1
- **Router**: Vue Router 4.6.3
- **UI Framework**: Ant Design Vue 4.2.6
- **Styling**: Tailwind CSS 3.4.18, Less 4.4.2
- **Build Tool**: Vite (rolldown-vite 7.2.5)
- **Testing**: Playwright 1.56.1
- **Code Quality**: ESLint 9.39.1, Prettier 3.6.2
- **Key Dependencies**:
  - **dompurify** 3.3.0 - DOM sanitization
  - **marked** 16.4.2 - Markdown parsing
  - **typeit** 8.8.7 - Typing animation
  - **ignore** 7.0.5 - File ignore patterns
  - **crx** 5.0.1 - Chrome extension packing

## Project Structure

```
bug-v3/
├── src/                          # Main source code
│   ├── background/              # Service worker (Chrome extension background script)
│   │   ├── background.ts        # Main background script entry point
│   │   ├── handlers/            # Event handlers for extension communication
│   │   ├── services/            # Background services (storage, sync, etc.)
│   │   ├── init.ts              # Initialization logic
│   │   └── utils/               # Background-specific utilities
│   │
│   ├── content/                 # Content scripts (injected into web pages)
│   │   ├── content.ts           # Main content script entry point
│   │   ├── bilibili/            # Bilibili site-specific implementation
│   │   ├── discourse/           # Discourse forum support
│   │   ├── pixiv/               # Pixiv support
│   │   ├── reddit/              # Reddit support
│   │   ├── x/                   # X/Twitter support
│   │   ├── xhs/                 # Xiaohongshu (Little Red Book) support
│   │   ├── standalone/          # Generic web page support
│   │   ├── data/                # Content script data
│   │   └── utils/               # Content script utilities
│   │
│   ├── popup/                   # Extension popup UI
│   │   └── main.ts              # Popup entry point
│   │
│   ├── options/                 # Extension options/settings page
│   │   ├── Options.vue          # Main options component
│   │   ├── main.ts              # Options page entry point
│   │   ├── router/              # Options page routing
│   │   ├── tabs/                # Tab components (BilibiliImport, Upload, Settings, etc.)
│   │   ├── pages/               # Page components
│   │   ├── modals/              # Modal components (AddEmojiModal, ImportEmojisModal)
│   │   ├── components/          # Reusable UI components
│   │   ├── composables/         # Vue composables
│   │   ├── tenor/               # Tenor API integration
│   │   ├── utils/               # Options-specific utilities
│   │   └── types.ts             # Type definitions
│   │
│   ├── userscript/              # Userscript-specific code
│   │   └── [userscript builds]  # Tampermonkey/Violentmonkey targets
│   │
│   ├── stores/                  # Pinia state management
│   │   └── useEmojiStore        # Main emoji store managing groups, settings, favorites
│   │
│   ├── styles/                  # Global styles
│   ├── utils/                   # Shared utilities across all contexts
│   ├── types/                   # TypeScript type definitions
│   ├── config/                  # Configuration files
│   ├── assets/                  # Static assets (images, icons, etc.)
│   ├── App.vue                  # Root Vue component
│   └── main.ts                  # Main entry point
│
├── public/                       # Public assets (manifest.json, icons, etc.)
├── docs/                         # Documentation
├── scripts/                      # Build and utility scripts
│   ├── build.js                 # Main build orchestrator
│   ├── watch.js                 # Watch mode for development
│   ├── pack-crx.js              # Chrome extension packing
│   ├── release.sh               # Release automation
│   ├── cfworker/                # Cloudflare Worker scripts
│   └── docs/                    # Build flags and configuration docs
│
├── test-results/                # Playwright test results
├── playwright-report/           # Test reports
├── dist/                        # Build output directory
├── index.html                   # Popup/options page entry point
├── popup.html                   # Popup HTML
├── options.html                 # Options page HTML
├── vite.config.ts               # Vite configuration
├── vite.config.userscript.ts    # Vite config for userscript builds
├── playwright.config.ts         # Playwright configuration
├── playwright.extension.config.ts # Extension-specific test config
├── tsconfig.json                # TypeScript configuration
├── postcss.config.js            # PostCSS configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── eslint.config.js             # ESLint configuration
├── .prettierrc                   # Prettier formatting configuration
├── package.json                 # Project dependencies and scripts
├── pnpm-workspace.yaml          # Workspace configuration
├── pnpm-lock.yaml               # Dependency lock file
├── package.json                 # Project metadata
├── components.d.ts              # Auto-generated component types
├── LICENSE.md                   # GPL-3.0 license with attribution
├── README.md                    # Comprehensive README
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guidelines
├── CLAUDE.md                    # Guidance for Claude AI
├── PERMISSIONS.md               # Extension permissions explanation
├── SYNC_DOCUMENTATION.md        # Sync setup guides
├── GEMINI_FEATURES.md           # AI features documentation
└── .github/                     # GitHub configuration and workflows
```

## Key Features

### 🎯 Core Emoji Management
- **Universal Emoji Picker**: Insert custom emojis on any website with a single click
- **Smart Organization**: Group emojis by category with drag-and-drop reordering
- **Quick Search**: Fast emoji search and filtering across all groups
- **Favorites System**: Mark frequently used emojis for quick access

### 🤖 AI-Powered Features
- **Automatic Naming**: Uses Google Gemini API to intelligently name emojis
- **Batch Rename**: Rename multiple emojis at once with AI assistance
- **Duplicate Detection**: Find similar emojis using perceptual hashing
- **Smart References**: Reduce storage by referencing duplicate emojis

### 🔄 Synchronization & Storage
- **Chrome Sync**: Automatic backup to Chrome's sync storage
- **WebDAV Support**: Sync with Nextcloud, ownCloud, and other WebDAV servers
- **S3 Compatible**: AWS S3, MinIO, Backblaze B2, and similar providers
- **Multi-Device**: Keep emojis synchronized across all devices
- **Progressive Multi-Layer Storage**: Intelligent data management across storage layers

### 🎨 User Experience
- **Modern UI**: Built with Vue 3, Ant Design Vue, and Tailwind CSS
- **Responsive Design**: Mobile-optimized with touch support
- **Drag & Drop**: Intuitive emoji and group management
- **Lazy Loading**: Optimized for large emoji collections
- **Multiple Platforms**: Support for Discourse, Bilibili, Pixiv, Reddit, X/Twitter, Xiaohongshu

### ⚡ Performance & Optimization
- **Compile-Time Optimization**: Multiple build configurations for different use cases
- **Bundle Size Options**: Configurable logging and IndexedDB support
- **Lazy Rendering**: Only visible emojis are rendered
- **Image Lazy Loading**: Images load on demand
- **Code Splitting**: Granular chunk splitting for faster loading

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **Package Manager**: npm, yarn, or pnpm
- **Browser**: Chrome, Edge, Firefox (or equivalent Chromium/WebKit-based browser)

### Installation

```bash
# Clone the repository
git clone https://github.com/stevessr/bug-v3.git
cd bug-v3

# Install dependencies
npm install
# or: pnpm install

# Start development server
npm run dev
```

### Browser Installation

**Chrome/Edge:**
1. Open browser extensions page (`chrome://extensions/` or `edge://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from the build output

**Firefox:**
1. Open `about:addons`
2. Click the settings icon and select "Install Add-on from File"
3. Select the packaged extension

## Development

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development build with hot-reloading (all features enabled) |
| `npm run watch` | Watch mode for automatic rebuilding |
| `npm run build` | Standard production build (all features enabled) |
| `npm run build:prod` | Production build without console logging (smaller bundle) |
| `npm run build:minimal` | Minimal build without logging or IndexedDB (smallest bundle) |
| `npm run build:debug` | Debug build with source maps |
| `npm run build:userscript` | Build userscripts for Tampermonkey |
| `npm run build:userscript:min` | Build minified userscripts |
| `npm run serve` | Preview production build |
| `npm run test` | Run all Playwright tests |
| `npm run test:debug` | Run tests in debug mode |
| `npm run test:extension` | Run extension-specific tests |
| `npm run test:extension:debug` | Debug extension tests |
| `npm run lint` | Lint code for issues |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run type-check` | TypeScript type checking |
| `npm run pack:crx` | Pack extension as CRX file |
| `npm run release` | Automated release process |

### Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```
   This builds all components and watches for changes

2. **Load Extension in Browser**:
   - Open browser extensions page
   - Enable Developer mode
   - Load the `dist` folder

3. **Make Changes**:
   - Edit files in `src/`
   - Changes automatically rebuild and hot-reload

4. **Test Changes**:
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```

5. **Build for Production**:
   ```bash
   npm run build:prod
   ```

### Build Configurations

The project supports multiple build configurations optimized for different scenarios:

| Build Type | Logging | IndexedDB | Bundle Size | Use Case |
|-----------|---------|-----------|-------------|----------|
| Development | ✅ | ✅ | ~3-4MB | Local development |
| Standard | ✅ | ✅ | ~2-3MB | General production |
| Production | ❌ | ✅ | ~1.5-2MB | Smaller bundle size |
| Minimal | ❌ | ❌ | ~1-1.5MB | Restricted environments |
| Userscript | ✅ | ❌ | ~1-1.5MB | Tampermonkey/Violentmonkey |

See [BUILD_FLAGS.md](./scripts/docs/BUILD_FLAGS.md) for compile-time optimization flags.

### Code Quality

```bash
# Lint all code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting without changing
npm run format:check

# TypeScript type checking
npm run type-check
```

## Configuration

### TypeScript Configuration

The project uses strict TypeScript with:
- Target: ES2020
- Module: ESNext
- Strict mode enabled
- No unused variables/parameters
- Path alias: `@/*` → `src/*`

### Vite Configuration

- **Entry Points**: Separate builds for popup, background, and content scripts
- **Module Resolution**: Bundler mode with alias resolution
- **Auto-Import Plugins**: Unplugin Vue Components for auto-importing UI components
- **CSS Processing**: PostCSS with Tailwind and Less support
- **Code Splitting**: Granular chunk splitting by module and vendor
- **Minification**: Terser with aggressive compression options

### Build Flags

Compile-time flags allow conditional feature inclusion:
- `__ENABLE_LOGGING__`: Enable/disable console logging
- `__USE_INDEXEDDB__`: Enable/disable IndexedDB support
- Custom flags defined in build scripts

## Architecture

### Storage System

The extension uses a sophisticated **progressive multi-layer storage system** with automatic conflict resolution:

```
Priority Chain (fastest to slowest):
1. Local Storage      (0ms - immediate)
2. Session Storage   (100ms - session cache)
3. Extension Storage (500ms - Chrome API)
4. IndexedDB         (1000ms - persistent)
```

**Key Features**:
- **Timestamp-Based Conflict Resolution**: Newer data always wins
- **Split Group Storage**: Individual storage per group (not monolithic)
- **Progressive Writes**: Data syncs across layers with timed delays
- **Cross-Context Sync**: Real-time updates between popup, options, and content scripts
- **Automatic Persistence**: Graceful fallback between storage layers

### Component Architecture

```
Background Service Worker
├── Storage Management
├── Sync Services
├── Event Handlers
└── Inter-component Communication

Content Scripts (per website)
├── Bilibili (auto-comment injection)
├── Discourse (forum integration)
├── Pixiv (image posting)
├── Reddit (comment injection)
├── X/Twitter (tweet composition)
├── Xiaohongshu (feed interaction)
└── Standalone (generic web support)

UI Layer
├── Popup (quick access)
├── Options Page (full management)
│   ├── Emoji Management
│   ├── Sync Settings
│   ├── Import/Export
│   └── AI Features
└── Pinia Store (state management)
```

### State Management

- **Pinia Store** (`useEmojiStore`):
  - Manages emoji groups and their data
  - Tracks user settings and preferences
  - Maintains favorites list
  - Handles import/export operations
  - Coordinates with storage system

### Communication

- **Background ↔ Content**: Chrome messaging API
- **Popup ↔ Options ↔ Background**: Pinia store with event sync
- **Storage Sync**: Event listeners for cross-context updates

## Testing

The project uses **Playwright** for end-to-end testing:

```bash
# Run all tests
npm run test

# Debug mode
npm run test:debug

# Extension-specific tests
npm run test:extension

# Debug extension tests
npm run test:extension:debug
```

Test configurations:
- **playwright.config.ts**: General web testing
- **playwright.extension.config.ts**: Chrome extension testing

## Deployment & Release

### Release Process

**Automated (Recommended)**:
```bash
git tag v1.0.1
git push origin v1.0.1
```

This triggers GitHub Actions to:
- Build the extension
- Create a GitHub release
- Upload to Microsoft Edge Store

**Manual Release**:
```bash
npm run release 1.0.1
```

### Chrome Extension Packing

```bash
npm run pack:crx
```

Creates a signed CRX file for distribution.

### Distribution Options

- **Chrome Web Store**: Automated via GitHub Actions
- **Microsoft Edge Add-ons**: Automated via GitHub Actions
- **Firefox Add-ons**: Manual submission (not yet automated)
- **GitHub Releases**: Source code and built packages
- **Direct Distribution**: CRX files and ZIP archives

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development environment setup
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting guidelines

Quick contributor setup:
```bash
git checkout -b feature/your-feature
npm run dev
# Make changes
npm run lint && npm run test
git commit -m "Add your feature"
git push origin feature/your-feature
# Open Pull Request
```

## Documentation

Complete documentation is available:

- **[README.md](./README.md)** - Comprehensive user and developer guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[PERMISSIONS.md](./PERMISSIONS.md)** - Extension permissions explained
- **[SYNC_DOCUMENTATION.md](./SYNC_DOCUMENTATION.md)** - WebDAV and S3 setup
- **[GEMINI_FEATURES.md](./GEMINI_FEATURES.md)** - AI features and Gemini API
- **[CLAUDE.md](./CLAUDE.md)** - Guidance for Claude Code assistant
- **[BUILD_FLAGS.md](./scripts/docs/BUILD_FLAGS.md)** - Compile-time options
- **[USERSCRIPT_GUIDE.md](./scripts/docs/USERSCRIPT_GUIDE.md)** - Userscript deployment
- **[docs/README.md](./docs/README.md)** - Complete documentation index

## License

This project is licensed under **GPL-3.0** with additional attribution requirements.

**Key Points**:
- ✅ Free to use, modify, and distribute
- ✅ Attribution to original source required
- ✅ Derivative works must also be GPL-3.0
- ✅ Can be published to Chrome/Edge stores with attribution

See [LICENSE.md](./LICENSE.md) for full details and [LICENSE-zh.md](./LICENSE-zh.md) for Chinese translation.

## Version History

**Latest**: v1.2.7-patch-2

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Acknowledgments

- **Vue 3**: Progressive JavaScript framework
- **Ant Design Vue**: Enterprise-grade UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Next-generation build tool
- **Playwright**: Browser automation testing
- **Google Gemini API**: AI-powered features
- **TypeScript**: Type-safe JavaScript

## Support & Community

- **GitHub Issues**: [Report bugs and request features](https://github.com/stevessr/bug-v3/issues)
- **GitHub Discussions**: [Ask questions and discuss ideas](https://github.com/stevessr/bug-v3/discussions)
- **Documentation**: See [docs/README.md](./docs/README.md)

---

**⭐ If you find this project useful, please star it on GitHub!**

Project Repository: [github.com/stevessr/bug-v3](https://github.com/stevessr/bug-v3)
