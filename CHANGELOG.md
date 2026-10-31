# Changelog

All notable changes to the Emoji Extension project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add a lazy-loaded custom WebM/MP4 player for Linux.do attachments. It reads the `.zip`-served bytes through a narrowly allowlisted userscript request and keeps a download link as fallback.

### Changed

- Rewrite the Linux.do voice userscript from the bundled Svelte runtime into readable, self-contained JavaScript while preserving recording, upload, playback and transcription behavior.

### Fixed

- Resolve Discourse video short URLs before loading media and remove the original 16:9 wrapper to prevent excess black space.

## [1.2.6] - 2024-11-14

### Added

- AI-powered emoji batch renaming feature with Gemini API integration
- Dedicated AI batch renaming tab in the options page
- Cross-group duplicate detection based on perceptual hashing
- Emoji reference system to reduce storage usage
- Language selection support for Gemini API naming
- Cloud sync settings page with improved UI
- WebDAV and S3 synchronization support
- Perceptual hash-based image similarity detection

### Changed

- Split settings into organized tabs for better UX
- Optimized emoji selector with improved icon and name display logic
- Enhanced duplicate detection with filter query capabilities
- Improved group navigation and routing in options page

### Fixed

- Resolved 'computed value is readonly' warning in Options.vue
- Fixed router history import (createWebHashHistory)
- Corrected navigation issues in options page
- Fixed linting issues across codebase

## [1.0.0] - Previous Release

### Added

- Complete storage architecture rewrite
- Progressive multi-layer storage system (Local Storage → Session Storage → Extension Storage → IndexedDB)
- Enhanced cross-context synchronization
- Split emoji group storage for better performance
- Automated release workflow
- Microsoft Edge Store integration
- Modern UI with Vue 3, Ant Design Vue, and Tailwind CSS
- Compile-time optimization flags for logging and IndexedDB
- Drag-and-drop support with mobile optimization
- Chrome sync storage support for configuration backup
