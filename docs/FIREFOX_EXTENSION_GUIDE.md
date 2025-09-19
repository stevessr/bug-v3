# Firefox Extension Installation Guide

This guide explains how to install and use the Firefox-compatible emoji extension.

## 🦊 Quick Start

### Build and Package for Firefox

```bash
# Build Firefox extension (with logging enabled)
npm run build:firefox

# Build Firefox extension (production - no logging)
npm run build:firefox:prod

# Package for distribution
npm run package:firefox
```

This creates `emoji-extension-firefox.zip` ready for installation.

### Install in Firefox

1. **Temporary Installation (Developer Mode)**:
   - Open Firefox and go to `about:debugging`
   - Click "This Firefox" 
   - Click "Load Temporary Add-on"
   - Select `emoji-extension-firefox.zip` or navigate to `dist-firefox/manifest.json`

2. **Permanent Installation**:
   - Rename `emoji-extension-firefox.zip` to `emoji-extension-firefox.xpi`
   - In Firefox, go to `about:addons`
   - Drag and drop the `.xpi` file into Firefox

## 📁 Firefox Build Structure

```
dist-firefox/
├── manifest.json          # Firefox Manifest v3 with gecko settings
├── js/
│   ├── polyfill.js        # Browser API compatibility layer
│   ├── background.js      # Background script (works with Firefox APIs)
│   ├── content.js         # Content script with Firefox compatibility
│   ├── popup.js          # Popup UI
│   ├── options.js        # Options page
│   └── ...               # Other compiled scripts
├── assets/               # CSS and static assets
├── img/                  # Extension icons
└── *.html               # HTML pages
```

## 🔧 Firefox-Specific Features

### Cross-Browser API Compatibility

The extension includes comprehensive browser API compatibility:

- **Unified API**: Works with both `chrome.*` and `browser.*` APIs
- **Promise Support**: Handles Firefox's Promise-based APIs automatically
- **Polyfill**: Runtime compatibility layer for consistent behavior

### Firefox Manifest v3

Key Firefox-specific manifest features:

```json
{
  "manifest_version": 3,
  "background": {
    "scripts": ["js/polyfill.js", "js/background.js"],
    "type": "module"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "{emoji-extension@example.com}",
      "strict_min_version": "109.0"
    }
  }
}
```

### Performance Optimizations

- **Minified Code**: Production builds are optimized for Firefox
- **Efficient Loading**: Polyfill loads before other scripts
- **Memory Management**: Proper cleanup and resource management

## 🚀 Development Workflow

### Cross-Browser Development

```bash
# Chrome extension
npm run build

# Firefox extension  
npm run build:firefox

# Package Firefox extension
npm run package:firefox
```

### Testing in Firefox

1. **Load Extension**: Use `about:debugging` for development
2. **Console Logs**: Check Browser Console (Ctrl+Shift+J)
3. **Extension Debug**: Click "Inspect" next to your extension
4. **Storage**: View extension storage in Developer Tools

### Hot Development

```bash
# Install web-ext for Firefox development
npm install -g web-ext

# Run with auto-reload
cd dist-firefox
web-ext run --reload
```

## 🔍 Firefox Compatibility Features

### API Differences Handled

| Chrome API | Firefox API | Compatibility |
|------------|-------------|---------------|
| `chrome.storage.local.get()` | `browser.storage.local.get()` | ✅ Unified wrapper |
| Callback-based | Promise-based | ✅ Auto-conversion |
| `chrome.runtime.sendMessage()` | `browser.runtime.sendMessage()` | ✅ Cross-compatible |

### Content Script Loading

Firefox content scripts include the polyfill automatically:

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["js/polyfill.js", "js/content.js"]
  }
]
```

### Background Script Compatibility

Background scripts work in both environments:

```javascript
// This works in both Chrome and Firefox
const api = getBrowserAPI()
const data = await api.storage.local.get('key')
```

## 🐛 Troubleshooting

### Common Issues

1. **"Extension not loading"**:
   - Check Firefox version (requires 109.0+)
   - Verify manifest.json syntax
   - Check for console errors

2. **Storage not working**:
   - Verify permissions in manifest
   - Check if storage API is available
   - Review browser console for errors

3. **Content scripts not injecting**:
   - Check host permissions
   - Verify script loading order
   - Review content security policy

### Debug Tips

```javascript
// Check which browser API is available
console.log('Chrome:', typeof chrome !== 'undefined')
console.log('Browser:', typeof browser !== 'undefined')

// Test storage access
const api = getBrowserAPI()
if (api) {
  console.log('Browser API available')
} else {
  console.error('No browser API found')
}
```

## 📦 Distribution

### Firefox Add-ons (AMO)

1. Build production version: `npm run build:firefox:prod`
2. Package: `npm run package:firefox`  
3. Test thoroughly in Firefox
4. Submit to [addons.mozilla.org](https://addons.mozilla.org/developers/)

### Self-Distribution

1. Build and package the extension
2. Host the `.xpi` file on your server
3. Users can install via direct download
4. Consider code signing for user trust

## 🔧 Advanced Configuration

### Custom Extension ID

Update `public/manifest-firefox.json`:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "{your-unique-id@your-domain.com}",
      "strict_min_version": "109.0"
    }
  }
}
```

### Content Security Policy

For stricter security:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

This emoji extension now works seamlessly across both Chrome and Firefox! 🎉