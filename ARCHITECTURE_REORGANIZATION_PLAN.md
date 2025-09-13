# Chrome Extension Architecture Reorganization Plan

## Current State Analysis

### Current Directory Structure

```
src/
├── background/          # Background scripts (service worker)
├── components/          # ✅ REMOVED - moved to options/components
├── config/              # Build configuration and flags
├── content/             # Content scripts for different platforms
├── options/             # Options page UI and logic
├── popup/               # Popup UI and logic
├── stores/              # Pinia state management
├── styles/              # Global styles
├── tenor/               # Tenor GIF integration
├── types/               # TypeScript type definitions
├── userscript/          # Userscript variant
├── utils/               # Shared utilities
├── views/               # Additional views
└── waline/              # Waline comment system integration
```

### Identified Issues

1. **Mixed concerns**: Utils directory contains both generic utilities and domain-specific logic
2. **Storage fragmentation**: Multiple storage implementations across different contexts
3. **Platform-specific code scattered**: Content scripts for different platforms mixed with generic logic
4. **Large monolithic files**: Several files over 500+ lines need modularization
5. **Inconsistent module boundaries**: Some modules have unclear responsibilities

## Proposed Reorganization

### Phase 1: Storage Layer Consolidation

**Goal**: Centralize all storage-related functionality into a dedicated domain

#### New Structure:

```
src/storage/
├── adapters/
│   ├── chrome-extension.ts    # Chrome extension storage API
│   ├── content-script.ts      # Content script storage adapter
│   ├── userscript.ts          # Userscript localStorage adapter
│   └── indexed-db.ts          # IndexedDB implementation
├── managers/
│   ├── emoji-manager.ts       # Emoji data management
│   ├── settings-manager.ts    # Settings management
│   └── favorites-manager.ts   # Favorites management
├── types.ts                   # Storage-related types
└── index.ts                   # Main storage API
```

#### Migration Tasks:

- [ ] Move `src/utils/newStorage.ts` → `src/storage/managers/`
- [ ] Move `src/utils/indexedDB.ts` → `src/storage/adapters/indexed-db.ts`
- [ ] Move `src/content/utils/ContentStorageAdapter.ts` → `src/storage/adapters/content-script.ts`
- [ ] Move `src/userscript/userscript-storage.ts` → `src/storage/adapters/userscript.ts`
- [ ] Create unified storage interface in `src/storage/index.ts`

### Phase 2: Platform Integration Reorganization

**Goal**: Organize platform-specific integrations by functional domain

#### New Structure:

```
src/platforms/
├── content-scripts/
│   ├── discourse/
│   │   ├── injection.ts       # DOM injection logic
│   │   ├── picker.ts          # Emoji picker implementation
│   │   └── index.ts           # Main discourse integration
│   ├── pixiv/
│   │   ├── button.ts          # Add emoji button
│   │   ├── helpers.ts         # Pixiv-specific utilities
│   │   └── index.ts           # Main pixiv integration
│   ├── bilibili/
│   │   └── index.ts           # Bilibili integration
│   ├── x-twitter/
│   │   ├── main.ts            # Main X/Twitter logic
│   │   ├── video-copy.ts      # Video copying feature
│   │   └── carousel.ts        # Carousel handling
│   └── shared/
│       ├── injection-utils.ts # Shared injection utilities
│       ├── dom-utils.ts       # Shared DOM manipulation
│       └── detection.ts       # Platform detection logic
├── external-services/
│   ├── tenor/                 # Tenor GIF service
│   ├── waline/                # Waline comment system
│   └── discourse-api/         # Discourse API integration
└── userscript/
    ├── core/                  # Core userscript functionality
    ├── ui/                    # UI components for userscript
    └── integrations/          # Platform integrations for userscript
```

#### Migration Tasks:

- [ ] Move `src/content/` → `src/platforms/content-scripts/`
- [ ] Move `src/tenor/` → `src/platforms/external-services/tenor/`
- [ ] Move `src/waline/` → `src/platforms/external-services/waline/`
- [ ] Move `src/userscript/` → `src/platforms/userscript/`
- [ ] Extract shared utilities to `src/platforms/content-scripts/shared/`

### Phase 3: UI Component Architecture

**Goal**: Better organize UI components by functional domain and usage context

#### Current State:

```
src/options/components/     # Options-specific components ✅
src/options/modals/         # Options modals ✅
src/popup/components/       # Popup-specific components ✅
```

#### Enhancements:

```
src/ui/
├── components/
│   ├── shared/             # Truly shared components
│   │   ├── EmojiGrid.vue   # Reusable emoji grid
│   │   ├── LoadingSpinner.vue
│   │   └── ConfirmDialog.vue
│   ├── options/            # Options-specific (keep existing)
│   └── popup/              # Popup-specific (keep existing)
├── composables/
│   ├── useEmoji.ts         # Emoji-related composables
│   ├── useStorage.ts       # Storage composables
│   └── usePlatform.ts      # Platform detection composables
└── styles/
    ├── components/         # Component-specific styles
    ├── themes/             # Theme definitions
    └── utilities/          # Utility classes
```

#### Migration Tasks:

- [ ] Identify truly shared components and move to `src/ui/components/shared/`
- [ ] Create composables for common functionality
- [ ] Organize styles by component and theme

### Phase 4: Background Processing Architecture

**Goal**: Organize background scripts by functional responsibility

#### New Structure:

```
src/background/
├── handlers/
│   ├── emoji/              # Emoji-related handlers
│   │   ├── add-emoji.ts    # ✅ DONE - addEmojiFromWeb split
│   │   ├── download.ts     # ✅ DONE - downloadUpload handler
│   │   └── upload.ts       # ✅ DONE - fileReception handler
│   ├── storage/
│   │   ├── sync.ts         # Storage synchronization
│   │   └── migration.ts    # Data migration handlers
│   ├── api/
│   │   ├── discourse.ts    # Discourse API integration
│   │   └── external.ts     # External service APIs
│   └── system/
│       ├── context-menu.ts # Context menu handlers
│       ├── installation.ts # Installation/update handlers
│       └── cleanup.ts      # Periodic cleanup tasks
├── services/
│   ├── download-service.ts # File download service
│   ├── upload-service.ts   # File upload service
│   └── proxy-service.ts    # Proxy configuration service
├── utils/
│   ├── chrome-api.ts       # Chrome API utilities
│   └── message-router.ts   # Message routing utilities
└── background.ts           # Main background script entry
```

#### Migration Tasks:

- [x] Split `addEmojiFromWeb.ts` into focused handlers ✅ DONE
- [ ] Extract download/upload services from `downloadAndSend.ts`
- [ ] Organize handlers by functional domain
- [ ] Create message routing system

### Phase 5: Utilities and Shared Code

**Goal**: Organize utilities by functional domain and eliminate duplication

#### New Structure:

```
src/shared/
├── utils/
│   ├── dom/                # DOM manipulation utilities
│   │   ├── injection.ts    # Element injection utilities
│   │   ├── selection.ts    # Text selection utilities
│   │   └── events.ts       # Event handling utilities
│   ├── data/
│   │   ├── validation.ts   # Data validation utilities
│   │   ├── formatting.ts   # Data formatting utilities
│   │   └── transformation.ts # Data transformation utilities
│   ├── network/
│   │   ├── fetch.ts        # Network request utilities
│   │   ├── upload.ts       # File upload utilities
│   │   └── download.ts     # File download utilities
│   └── platform/
│       ├── detection.ts    # Platform/browser detection
│       ├── compatibility.ts # Cross-platform compatibility
│       └── feature-flags.ts # Feature flag utilities
├── types/
│   ├── emoji.ts            # Emoji-related types
│   ├── storage.ts          # Storage-related types
│   ├── platform.ts         # Platform-related types
│   └── api.ts              # API-related types
├── constants/
│   ├── platforms.ts        # Platform constants
│   ├── storage-keys.ts     # Storage key constants
│   └── api-endpoints.ts    # API endpoint constants
└── config/
    ├── build-flags.ts      # ✅ DONE - Vite-based conditional compilation
    ├── defaults.ts         # Default configuration values
    └── environment.ts      # Environment-specific configuration
```

#### Migration Tasks:

- [x] Update build flags system ✅ DONE
- [ ] Move `src/utils/` files to appropriate `src/shared/utils/` subdirectories
- [ ] Consolidate type definitions in `src/shared/types/`
- [ ] Extract constants to `src/shared/constants/`
- [ ] Remove duplicate utility functions across modules

## Implementation Strategy

### Priority Order:

1. **Phase 1 (Storage)** - Critical for data consistency and performance
2. **Phase 4 (Background)** - Important for maintainability and debugging
3. **Phase 2 (Platforms)** - Improves code organization and platform support
4. **Phase 5 (Utilities)** - Reduces duplication and improves reusability
5. **Phase 3 (UI)** - Final polish for component architecture

### Migration Approach:

1. **Create new structure** alongside existing code
2. **Migrate modules incrementally** with proper import updates
3. **Test functionality** after each migration step
4. **Remove old files** only after successful migration
5. **Update build configuration** to reflect new structure

### Success Metrics:

- [ ] Reduced file sizes (target: no files over 300 lines except data files)
- [ ] Improved module cohesion (single responsibility principle)
- [ ] Reduced coupling between modules
- [ ] Better test coverage through modular architecture
- [ ] Improved developer experience with clearer code organization

## Next Steps

1. **Review and approve** this reorganization plan
2. **Start with Phase 1** (Storage Layer Consolidation)
3. **Create detailed implementation tasks** for each phase
4. **Set up automated testing** to ensure no functionality regression
5. **Document migration progress** and update architecture decisions
