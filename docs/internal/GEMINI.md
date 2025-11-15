## Project Overview

This is a browser extension for managing and using emojis. It's built with Vue 3, Vite, and TypeScript. The extension features a multi-layered storage system, real-time synchronization across different parts of the extension (popup, options page, content scripts), and a modern UI using Ant Design Vue and Tailwind CSS. It also supports cloud sync via Chrome sync, WebDAV, and S3-compatible storage.

The project includes different build configurations to optimize for production, including options to disable logging and IndexedDB for smaller bundle sizes. It can also be built as a userscript for use with Tampermonkey or Violentmonkey.

## Building and Running

### Prerequisites

- Node.js 18+
- pnpm (or npm)

### Setup

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start development server with hot-reloading
pnpm run dev
```

### Building

```bash
# Standard production build
pnpm run build

# Production build without logging
pnpm run build:prod

# Minimal build (no logging, no IndexedDB)
pnpm run build:minimal

# Build userscripts
pnpm run build:userscript
```

### Testing

```bash
# Run Playwright tests
pnpm run test

# Run Playwright tests in debug mode
pnpm run test:debug
```

## Development Conventions

### Code Style

The project uses ESLint and Prettier for code linting and formatting.

- **Linting:** `pnpm run lint`
- **Formatting:** `pnpm run format`

### Project Structure

The `src` directory is organized as follows:

- `src/background/`: Service worker for the extension.
- `src/content/`: Content scripts that are injected into web pages.
- `src/popup/`: The main popup UI.
- `src/options/`: The extension's options page.
- `src/storage/`: The multi-layered storage system.
- `src/stores/`: Pinia stores for state management.
- `src/userscript/`: Code specific to the userscript builds.

### Build Process

The project uses Vite for building. The build process is configured in `vite.config.ts` and is orchestrated by scripts in the `scripts/` directory. The build system uses compile-time flags to create different build versions.

### Content Script Injection

The content scripts in `src/content/` are injected by the backend and cannot use ES module `import` statements to import modules from outside of the `src/content/` directory. However, they can use imports internally.
