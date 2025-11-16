# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, feature-rich browser extension for managing and using custom emojis across the web. Built with Vue 3, Vite, and TypeScript, it features a progressive multi-layer storage system, AI-powered features, and compile-time optimization flags.

## Key Features

- **Universal Emoji Picker**: Insert custom emojis on any website with a single click
- **Multiple Input Modes**: Support for single emoji, batch import, URL import from Bilibili/Tenor/Waline
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

### Components
- **Background Script**: Handles storage synchronization and browser events
- **Content Script**: Injects emoji picker into web pages (supports Discourse, Bilibili, Pixiv, X/Twitter, Reddit, Xiaohongshu)
- **Popup**: Quick emoji access interface
- **Options**: Full emoji management and settings page
- **State Management**: Uses Pinia with useEmojiStore managing emoji groups, settings, and favorites

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