# Tampermonkey-Specific Features

This document describes the Tampermonkey-specific features implemented in the Emoji Extension userscript.

## Overview

The userscript now supports Tampermonkey-specific functionality that provides enhanced user experience when running in Tampermonkey. These features are only enabled when building with the `tampermonkey` variant.

## Features

### 1. Tampermonkey Menu Command

When the Tampermonkey variant is built, the script registers a menu command that appears in Tampermonkey's script menu:

- **Menu Item**: "Open Emoji Settings"
- **Access**: Click on the Tampermonkey icon → Select the script → Click "Open Emoji Settings"
- **Function**: Opens the emoji manager/settings panel

### 2. GM API Grants

The Tampermonkey variant includes the following GM API grants in the userscript metadata:

```javascript
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
```

These grants enable:
- **GM_registerMenuCommand**: Register the settings menu command
- **GM_openInTab**: Open the emoji manager in a new tab with better control
- **GM_getValue/GM_setValue**: Store and retrieve settings (for future use)

### 3. Floating Settings Button

A floating button is automatically injected into the page for quick access:

- **Position**: Bottom-right corner of the page
- **Label**: "Emoji ⚙"
- **Style**: Dark themed, unobtrusive button with shadow
- **Function**: Click to open the emoji manager/settings

### 4. Multiple Opening Strategies

The Tampermonkey runtime helper attempts multiple strategies to open the settings:

1. **Global Function**: Calls `window.__emoji_extension_openManager()` if exposed
2. **Custom Event**: Dispatches `emoji-extension-open-manager` event
3. **GM_openInTab**: Opens the manager URL using Tampermonkey's API
4. **Fallback**: Opens `/emoji-manager.html` in a new tab

## Building Tampermonkey Variant

### Standard Build

```bash
npm run build:userscript:tampermonkey
```

This creates: `dist/emoji-extension.tampermonkey.user.js`

### Minified Build

```bash
npm run build:userscript:tampermonkey:min
```

This creates: `dist/emoji-extension.tampermonkey-min.user.js`

### Manual Build with Environment Variable

You can also build with the variant environment variable:

```bash
USERSCRIPT_VARIANT=tampermonkey node scripts/build.js build:userscript
```

## Implementation Details

### File Structure

The implementation is in `scripts/post-process-userscript.js`:

1. **`getUserscriptHeader()`**: Conditionally adds Tampermonkey grants based on variant
2. **`getTampermonkeyRuntimeSnippet()`**: Returns the runtime helper code
3. **`processUserscript()`**: Injects the runtime helper when variant includes "tampermonkey"

### Conditional Injection

The Tampermonkey-specific code is only injected when:

```javascript
String(normalizedVariant).toLowerCase().includes('tampermonkey')
```

This means any variant name containing "tampermonkey" (case-insensitive) will enable these features.

### Runtime Helper Code

The runtime helper is injected immediately after the userscript header and before the main script content:

```
[Header with Tampermonkey grants]
[Tampermonkey runtime helper - menu command, floating button, etc.]
[Main userscript content]
[Footer]
```

## Default Variant Behavior

When building without the `tampermonkey` variant (default behavior):

- **Grant**: `// @grant none` (no special permissions)
- **No menu command**: The menu command is not registered
- **No floating button**: The floating button is not injected
- **No runtime helper**: The Tampermonkey-specific code is not included

This ensures maximum compatibility with other userscript managers (Greasemonkey, Violentmonkey, etc.).

## Testing

To test the Tampermonkey features:

1. Build the Tampermonkey variant:
   ```bash
   npm run build:userscript:tampermonkey
   ```

2. Install the generated file in Tampermonkey:
   - Open `dist/emoji-extension.tampermonkey.user.js`
   - Copy the content or drag-and-drop into Tampermonkey

3. Verify the features:
   - Check that the floating button appears in the bottom-right corner
   - Click the Tampermonkey icon and verify "Open Emoji Settings" appears in the menu
   - Test both the floating button and menu command to ensure they open the settings

## Future Enhancements

Potential future enhancements for the Tampermonkey variant:

- Use `GM_getValue`/`GM_setValue` for cross-domain settings storage
- Add more menu commands for quick actions (e.g., "Add Emoji", "Import/Export")
- Use `GM_xmlhttpRequest` for enhanced network requests
- Add keyboard shortcuts using `GM_registerMenuCommand` with accessKey

## Compatibility

- **Tampermonkey**: Full support with all features
- **Violentmonkey**: Partial support (may support some GM APIs)
- **Greasemonkey**: Use default variant (no Tampermonkey-specific features)
- **Other managers**: Use default variant for maximum compatibility

## Notes

- The Tampermonkey variant is optional and not required for basic functionality
- The default variant works on all userscript managers
- The floating button uses high z-index (2147483647) to ensure visibility
- All Tampermonkey-specific code is wrapped in try-catch blocks for safety

