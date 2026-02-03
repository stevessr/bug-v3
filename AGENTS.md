# Repository Guidelines

## Project Overview

A modern, feature-rich browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite, TypeScript, and progressive multi-layer storage system, featuring AI-powered capabilities, WebAssembly optimization, and compile-time optimization flags.

**Language Support:** zh (中文), en (English)

## Project Structure & Module Organization

### Core Directories

- `src/`: Vue 3 + TypeScript extension code
  - `background/`: Service worker handling storage sync and browser events
  - `content/`: Content scripts injected into web pages
  - `popup/`: Extension popup UI for quick emoji access
  - `options/`: Options/settings page for full emoji management
  - `sidebar/`: Sidebar functionality
  - `agent/`: AI agent integration and logic
  - `services/`: Service layer for business logic
  - `stores/`: Pinia state management stores
  - `composables/`: Vue 3 Composition API composables
  - `components/`: Reusable Vue components
  - `types/`: TypeScript type definitions
  - `utils/`: Shared utility functions
  - `styles/`: Global styles and CSS
  - `App.vue`: Root Vue component
  - `main.ts`: Application entry point
  - `discourse.ts`: Discourse integration

- `public/`: Static assets copied into builds
  - `manifest.json`: Extension manifest
  - `_locales/`: Internationalization files
  - `assets/`: Static assets (images, CSS)
  - `img/`: Extension icons
  - `js/`: JavaScript utilities
  - `wasm/`: WebAssembly modules

- `scripts/`: Build, release, and development tools
  - `tests/`: Playwright test suite
  - `cfworker/`: Cloudflare Workers for data deployment
  - `collaborative-upload-server/`: Server for collaborative uploads
  - `mcp-bridge/`: MCP (Model Context Protocol) bridge
  - `webm-to-avif-backend/`: AVIF conversion backend
  - `wasm/`: WebAssembly build scripts
  - Various build/packaging utilities

- `dist/`: Build output for loading the extension in a browser
- `docs/`: Documentation and guides
  - `internal/`: Internal documentation
  - `gemini/`: Gemini API integration docs
  - `optimizations/`: Optimization reports
  - `promo_assets/`: Promotional materials

## Build, Test, and Development Commands

**IMPORTANT:** This project uses **pnpm** as the package manager. Do NOT use npm.

### Development Commands

```bash
pnpm dev          # Development build via custom script, outputs to dist/
pnpm watch        # Rebuild on changes for iterative work
pnpm serve        # Preview built assets
```

### Build Commands

```bash
pnpm build        # Standard production build (all features enabled)
pnpm build:prod   # Production build without logging (smaller bundle size)
pnpm build:minimal# Minimal build (no logging, smallest bundle, basic features)
pnpm build:debug  # Debug build with enhanced logging
```

### Testing Commands

```bash
pnpm test                  # Playwright test suite (headless by default)
pnpm test:debug            # Run tests in debug mode
pnpm test:extension        # Extension-specific Playwright config
pnpm test:extension:debug  # Debug extension tests
```

### Code Quality Commands

```bash
pnpm lint         # ESLint code check
pnpm lint:fix     # Fix linting issues automatically
pnpm format       # Format code with Prettier
pnpm format:check # Check formatting
pnpm type-check   # TypeScript type checking
pnpm check:all    # Run all checks (lint + format + type-check)
```

### Release & Packaging Commands

```bash
pnpm release      # Run release script
pnpm release:all  # Complete release process
pnpm pack:crx     # Package as Chrome extension (.crx)
pnpm pack:xpi     # Package as Firefox extension (.xpi)
pnpm pack:zip     # Package as ZIP
pnpm pack:all     # Package all formats and update data
```

### Update & Deployment Commands

```bash
pnpm update:metadata # Update market metadata
pnpm update:data     # Deploy data to Cloudflare Pages
pnpm update:deploy   # Run update deployment script
pnpm update:all      # Build + package + deploy complete pipeline
```

### Utility Commands

```bash
pnpm key:generate   # Generate extension keys
pnpm key:backup     # Backup extension keys
pnpm prepare:json   # Prepare JSON assets
pnpm update:wasm    # Build WebAssembly modules
pnpm share          # Start collaborative upload server
pnpm share:stop     # Stop collaborative upload server
pnpm avif           # Start AVIF conversion server
```

## Build Configurations & Optimization Flags

This project supports multiple build configurations optimized for different use cases:

| Build Type  | Logging | Use Case                        | Command              |
| ----------- | ------- | ------------------------------- | -------------------- |
| Development | ✅      | Development and debugging       | `pnpm dev`           |
| Standard    | ✅      | General production use          | `pnpm build`         |
| Production  | ❌      | Production with smaller size    | `pnpm build:prod`    |
| Minimal     | ❌      | Smallest bundle, basic features | `pnpm build:minimal` |
| Debug       | ✅✅    | Enhanced debugging              | `pnpm build:debug`   |

**Size Reduction:** Minimal build is approximately 15-40% smaller than standard build.

**Environment Variables:**

- `BUILD_SOURCEMAP`: Enable source maps (`true`/`false`)
- `BUILD_MANIFEST`: Enable manifest generation (`true`/`false`)
- `BUILD_MINIFIED`: Enable minification (`true`/`false`)
- `ENABLE_LOGGING`: Enable logging in development builds

## Coding Style & Naming Conventions

### Technology Stack

- **Framework:** Vue 3 with Composition API (`<script setup>`)
- **Language:** TypeScript with strict mode
- **State Management:** Pinia stores
- **UI Library:** Ant Design Vue
- **Styling:** Tailwind CSS + Less
- **Build Tool:** Vite (rolldown-vite)
- **Package Manager:** pnpm with workspace support

### Code Style

- Use ESLint + Prettier for code quality
- Format before committing (`pnpm lint:fix && pnpm format`)
- Follow Vue 3 Composition API best practices
- Use auto-imports for Vue, Pinia, and stores (configured in `vite.config.ts`)
- Use composables for reusable logic in `src/composables/`
- Store types in `src/types/` directory
- Feature-focused components in appropriate surface directories

### Directory Naming

- Lower-case folders for consistency
- Feature-based organization over type-based
- Shared utilities in `src/utils/`
- Type definitions in `src/types/`
- Store modules in `src/stores/`

### Import Conventions

- Use `@/` alias for src imports (e.g., `@/utils/helpers`)
- Auto-imported: Vue APIs, Pinia, stores, Ant Design components
- Manual imports: Custom utilities, external libraries

## Architecture & Key Systems

### Multi-Layer Storage System

Progressive storage with timestamp-based conflict resolution:

1. **Local Storage** - Immediate access (0ms latency)
2. **Session Storage** - Session-based cache (100ms delay)
3. **Extension Storage** - Chrome API storage (500ms delay)
4. **IndexedDB** - Persistent fallback (1000ms delay)

Features:

- Split emoji storage (individual groups)
- Cross-context synchronization
- Real-time updates between popup, options, and content scripts

### State Management

- **Pinia** stores for reactive state
- Main stores: `useGroupStore`, `useEmojiCrudStore`, `useFavoritesStore`, `useSyncStore`
- Cross-context sync for multi-surface extension

### Advanced Features

- **AI Integration:** Google Gemini API for emoji naming and batch operations
- **WASM Support:** Perceptual hashing, AVIF conversion
- **Rich Text:** ProseMirror editor integration
- **Cloudflare Workers:** Data deployment and CDN
- **MCP Bridge:** Model Context Protocol integration
- **Collaborative Uploads:** Server-based upload sharing

## Testing Guidelines

### Testing Framework

- **Primary:** Playwright for end-to-end testing
- **Config:** `playwright.config.ts` (standard), `playwright.extension.config.ts` (extension-specific)

### Test Organization

- Tests live in `scripts/tests/`
- Name tests with `.spec.ts` suffix
- Keep tests focused per feature
- Use `pnpm test:debug` for interactive debugging

### Running Tests

```bash
pnpm test              # Full test suite
pnpm test:debug        # Debug mode
pnpm test:extension    # Extension-specific tests
```

## Development Practices

### Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code style guidelines
3. Run quality checks: `pnpm check:all`
4. Test changes: `pnpm test`
5. Commit with conventional commits (see below)
6. Push and create pull request

### Conventional Commits

Follow prefix-style commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Build process, dependency updates
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `perf:` Performance improvements

Example: `feat: add batch emoji rename with AI assistance`

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test changes

## Release & Deployment Process

### Automated Release (Recommended)

1. Tag the version: `git tag v1.0.1`
2. Push tag: `git push origin v1.0.1`
3. GitHub Actions automatically:
   - Builds extension
   - Creates GitHub release
   - Uploads to Microsoft Edge Store

### Manual Release

```bash
pnpm release 1.0.1        # Run release script
# or
pnpm release:all          # Complete release with all packaging
```

### Packaging Formats

- `.crx` - Chrome extension (for manual loading)
- `.xpi` - Firefox extension (for manual loading)
- `.zip` - Generic format (for web stores)

## Security & Configuration Notes

### Extension Keys

- Treat extension keys (`*.pem`) as sensitive
- Avoid committing keys to repository
- Use `pnpm key:backup` to backup keys safely
- Generate new keys with `pnpm key:generate` if needed

### Data Deployment

- Use Cloudflare Pages for data deployment (`pnpm update:data`)
- Data stored in `scripts/cfworker/`
- Update deployment via `pnpm update:deploy`

### Sensitive Configuration

- API keys should not be hardcoded
- Use environment variables for sensitive data
- Check `.gitignore` for excluded files

## Project Dependencies

### Core Dependencies

- `vue@^3.5.26` - Vue 3 framework
- `pinia@^2.3.1` - State management
- `ant-design-vue@^4.2.6` - UI components
- `vue-router@^4.6.4` - Routing
- `dexie@^4.2.1` - IndexedDB wrapper
- `marked@^16.4.2` - Markdown parser
- `katex@^0.16.27` - LaTeX rendering
- `prosemirror-*` - Rich text editor
- `@anthropic-ai/sdk@^0.39.0` - AI SDK
- `zod@^4.3.5` - Schema validation

### Development Dependencies

- `typescript@^5.9.3` - TypeScript compiler
- `vite` (rolldown-vite@^7.3.1) - Build tool
- `@vitejs/plugin-vue@^6.0.3` - Vue plugin
- `playwright@^1.57.0` - Testing framework
- `eslint@^9.39.2` - Linting
- `prettier@^3.7.4` - Formatting
- `tailwindcss@^3.4.19` - CSS framework
- `vue-tsc@^3.2.2` - Vue TypeScript compiler

### Special Dependencies

- `libavif-wasm@^0.1.13` - AVIF image format
- `dompurify@^3.3.1` - HTML sanitization
- `nanoid@^5.1.6` - Unique ID generation

## Documentation Resources

- **[README.md](./README.md)** - Project overview and quick start
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history
- **[docs/README.md](./docs/README.md)** - Documentation index
- **[docs/AUTO_DOWNLOAD.md](./docs/AUTO_DOWNLOAD.md)** - Auto-download feature
- **[docs/SYNC_DOCUMENTATION.md](./docs/SYNC_DOCUMENTATION.md)** - Sync setup guide
- **[docs/GEMINI_FEATURES.md](./docs/GEMINI_FEATURES.md)** - AI features guide
- **[scripts/docs/BUILD_FLAGS.md](./scripts/docs/BUILD_FLAGS.md)** - Build flags documentation

## Pull Request Guidelines

### PR Requirements

- Clear description of changes
- Link to related issue (if any)
- Testing performed and results
- Screenshots for UI changes
- All quality checks passing (`pnpm check:all`)
- Tests added for new features
- Documentation updated if needed

### Review Process

- Maintain minimal git history with short messages
- Follow existing commit style
- Ensure all tests pass before merging
- Address review feedback promptly

## Performance Optimization

### Build Optimization

- Tree-shaking for unused code removal
- Code splitting for better loading
- Lazy loading for large collections
- Chunk optimization (vendor-ui, vendor-core, vendor-libs)
- Terser minification with aggressive compression

### Runtime Optimization

- Progressive multi-layer storage
- Split group storage
- Lazy rendering for visible emojis
- Image lazy loading
- WebAssembly for heavy computations

### Bundle Size Management

- Target chunk size: < 1000 kB
- Manual chunk splitting for optimal caching
- External heavy libraries when possible
- Conditional feature loading

## Troubleshooting

### Common Issues

- **Build failures:** Clear node_modules and reinstall with `pnpm install`
- **Type errors:** Run `pnpm type-check` for detailed error messages
- **Lint errors:** Use `pnpm lint:fix` for automatic fixes
- **Test failures:** Run `pnpm test:debug` for interactive debugging

### Development Server

- Use `pnpm dev` for development builds with hot reloading
- Use `pnpm watch` for automatic rebuilds on file changes
- Output directory: `dist/`

## Additional Notes

- **Browser Support:** Chrome, Edge (Firefox support in development)
- **Internationalization:** Built-in i18n support via `_locales/`
- **Icon Sizes:** 16x16, 48x48, 128x128 icons in `public/img/`
- **Manifest:** Version 3 Chrome extension manifest
- **Content Security Policy:** Follows Chrome extension CSP guidelines
