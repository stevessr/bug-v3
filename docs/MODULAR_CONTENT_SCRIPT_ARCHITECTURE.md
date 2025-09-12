# Modular Content Script Architecture

## Overview

This document describes the new modular, autonomous content script architecture implemented for the Chrome extension. The architecture follows the principle of **self-contained modules** where each content script is completely autonomous with no external dependencies.

## Architecture Principles

### 1. Self-contained Modules

- Each content script in `src/content/` is autonomous
- No dependencies on external functions from other content scripts
- No exported functions used by other content scripts
- Each script handles its own functionality independently

### 2. Content Script Categories

#### Website-specific Content Scripts

- **Bilibili**: `src/content/bilibili-autonomous.ts` → `js/content/bilibili.js`
- **Discourse**: `src/content/discourse-autonomous.ts` → `js/content/discourse.js`
- **Pixiv**: `src/content/pixiv-autonomous.ts` → `js/content/pixiv.js`
- **X/Twitter**: `src/content/x-autonomous.ts` → `js/content/x.js`

#### Auto-detection Content Scripts

- **Auto-detect**: `src/content/autodetect-autonomous.ts` → `js/content/autodetect.js`

#### Universal Content Scripts

- **Image Pages**: `src/content/images/image-inject.ts` → `js/content/images/image-inject.js`

### 3. Isolation Principle

For the same website, if there are multiple content scripts with different functionalities, they are implemented as separate autonomous scripts that do not interfere with each other.

## Technical Implementation

### Build System

- **Vite Configuration**: Updated `vite.config.ts` to build autonomous scripts
- **Entry Points**: Each autonomous script has its own entry point
- **Output Structure**: All compiled scripts are placed in `js/content/` subdirectory
- **File Naming**: Clean, predictable naming scheme (e.g., `bilibili.js`, `discourse.js`)

### Background Script Integration

- **Injection Logic**: Updated `src/background/scripting/index.ts` to reference autonomous scripts
- **File Mapping**: Correct mapping from page types to autonomous script files
- **Bridge Script**: Maintained for extension communication

### Manifest Configuration

- **Content Scripts**: Manifest references `js/content/autodetect.js` as the main entry point
- **Web Accessible Resources**: All scripts are properly accessible

## Autonomous Script Features

### Bilibili (`bilibili-autonomous.ts`)

- **Page Detection**: Autonomous Bilibili opus page detection
- **Image Processing**: Self-contained image URL extraction and button creation
- **DOM Injection**: Independent button injection and styling
- **Mutation Observation**: Self-managed DOM change detection

### Discourse (`discourse-autonomous.ts`)

- **Page Detection**: Independent Discourse page detection via meta tags
- **Storage Adapter**: Inlined simplified storage functionality
- **Emoji Picker**: Self-contained emoji picker creation and management
- **Toolbar Integration**: Autonomous button injection into editor toolbars

### Pixiv (`pixiv-autonomous.ts`)

- **Page Detection**: Independent Pixiv page and artwork detection
- **Image Processing**: Self-contained image URL validation and processing
- **Viewer Detection**: Autonomous Pixiv viewer detection
- **URL Change Handling**: Independent SPA navigation detection

### X/Twitter (`x-autonomous.ts`)

- **Page Detection**: Independent X/Twitter page detection
- **Multi-feature Support**: Image injection, carousel handling, image pages, video copy
- **Dynamic Content**: Self-managed mutation observation for dynamic content

### Auto-detect (`autodetect-autonomous.ts`)

- **Universal Detection**: Comprehensive page type detection logic
- **Injection Coordination**: Requests appropriate autonomous script injection
- **Image Page Handling**: Direct image page detection and script injection
- **CSRF Token Support**: Maintained compatibility features

## Inlined Utilities

Each autonomous script includes inlined versions of previously shared utilities:

### Common Inlined Functions

- **Button Creation**: `createOverlayButton()`, `setupButtonClick()`
- **Image Processing**: `extractImageName()`, `isValidImageUrl()`
- **Page Detection**: Site-specific detection logic
- **Storage Access**: Simplified storage adapters where needed
- **DOM Utilities**: Element finding and manipulation functions

### Benefits of Inlining

- **No External Dependencies**: Each script is completely self-contained
- **Reduced Complexity**: No shared state or cross-script dependencies
- **Better Isolation**: Scripts cannot interfere with each other
- **Easier Debugging**: All functionality is contained within single files

## File Structure

```
src/content/
├── autodetect-autonomous.ts     # Auto-detection and coordination
├── bilibili-autonomous.ts       # Complete Bilibili functionality
├── discourse-autonomous.ts      # Complete Discourse functionality
├── pixiv-autonomous.ts          # Complete Pixiv functionality
├── x-autonomous.ts              # Complete X/Twitter functionality
├── images/
│   └── image-inject.ts          # Universal image page (already autonomous)
└── injectedBridge.ts            # Extension communication bridge

dist/js/content/
├── autodetect.js                # Compiled auto-detection script
├── bilibili.js                  # Compiled Bilibili script
├── discourse.js                 # Compiled Discourse script
├── pixiv.js                     # Compiled Pixiv script
├── x.js                         # Compiled X/Twitter script
├── bridge.js                    # Compiled communication bridge
└── images/
    └── image-inject.js          # Compiled image page script
```

## Migration from Previous Architecture

### What Changed

1. **Removed Wrapper Scripts**: Old `content-*.ts` wrapper scripts eliminated
2. **Inlined Shared Utilities**: Previously shared utilities now inlined in each script
3. **Updated Build Configuration**: Vite config updated to build autonomous scripts
4. **Background Script Updates**: Injection logic updated for new file names

### What Remained

- **Functionality**: All existing features preserved
- **Extension Communication**: Bridge script maintained for background communication
- **Manifest Structure**: Content script registration unchanged
- **User Experience**: No changes to end-user functionality

## Benefits

### Development Benefits

- **Easier Maintenance**: Each script is self-contained and easier to understand
- **Reduced Coupling**: No dependencies between content scripts
- **Better Testing**: Each script can be tested independently
- **Clearer Responsibilities**: Each script has a single, clear purpose

### Runtime Benefits

- **Better Isolation**: Scripts cannot interfere with each other
- **Improved Reliability**: Failure in one script doesn't affect others
- **Reduced Memory Usage**: No shared objects or state between scripts
- **Faster Loading**: Each script loads only what it needs

### Build Benefits

- **Predictable Output**: Clear mapping from source to compiled files
- **Better Tree Shaking**: Each script only includes what it uses
- **Easier Debugging**: Source maps are cleaner and more focused

## Future Considerations

### Adding New Content Scripts

1. Create new autonomous script in `src/content/`
2. Add entry point to `vite.config.ts`
3. Update background script file mapping
4. Ensure all utilities are inlined

### Modifying Existing Scripts

- All changes should maintain autonomy principle
- Avoid creating dependencies on external modules
- Inline any new shared functionality

### Performance Optimization

- Monitor script sizes to ensure inlining doesn't cause bloat
- Consider code splitting only if scripts become too large
- Maintain balance between autonomy and efficiency

## Recent Updates (Latest Changes)

### Removed Page Detection from Autonomous Scripts

All autonomous content scripts no longer perform their own page detection, as this is now handled centrally by the auto-detection script:

- **Bilibili**: Removed `isBilibiliOpusPage()` check from initialization
- **Discourse**: Removed `isDiscoursePage()` check from initialization
- **Pixiv**: Removed `isPixivPage()` check from initialization
- **X/Twitter**: Removed `isXPage()` check from initialization

**Rationale**: The `autodetect-autonomous.ts` script handles all page detection and requests the background script to inject the appropriate autonomous content scripts. This eliminates redundant detection logic and ensures scripts only run when explicitly requested.

### Enhanced Discourse Integration

The Discourse content script has been completely rewritten to provide better integration:

#### Discourse-style Emoji Picker

- **Authentic Styling**: Uses genuine Discourse CSS classes (`fk-d-menu`, `emoji-picker__section`, etc.)
- **Proper Structure**: Matches the reference HTML structure from `docs/referense/simple.html`
- **Section Navigation**: Includes navigation tabs with emoji group icons
- **Search Functionality**: Maintains search input field for emoji filtering
- **Responsive Design**: Adapts to different screen sizes and contexts

#### Upload Menu Integration

- **File Upload Button**: Added missing upload functionality with dedicated button
- **Multi-file Support**: Supports uploading multiple emoji files simultaneously
- **Background Processing**: Integrates with extension's background script for file processing
- **User Feedback**: Provides visual feedback during upload process

#### Toolbar Integration

- **Dual Button System**: Both emoji picker and upload buttons in editor toolbars
- **Dynamic Detection**: Automatically detects and injects into new editor instances
- **Chat Support**: Works with both standard editor and chat composer toolbars

### Build Optimization Results

- **Reduced Bundle Sizes**:
  - Bilibili: 5.26 kB → 4.83 kB (8% reduction)
  - Pixiv: 4.89 kB → 4.68 kB (4% reduction)
  - X/Twitter: 6.62 kB → 6.30 kB (5% reduction)
  - Discourse: Enhanced functionality while maintaining 8.58 kB
- **Cleaner Architecture**: Removed redundant page detection logic
- **Maintained Functionality**: All existing features preserved while improving code organization

## Conclusion

The new modular content script architecture successfully achieves the goal of creating self-contained, autonomous content scripts while maintaining all existing functionality. The architecture is more maintainable, reliable, and follows modern best practices for Chrome extension development.

The latest updates further improve the architecture by centralizing page detection and enhancing the Discourse integration with authentic styling and missing upload functionality.
