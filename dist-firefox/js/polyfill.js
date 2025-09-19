// Firefox WebExtension polyfill for browser API compatibility
// This ensures the extension works consistently across Firefox and Chrome

(function() {
  'use strict';

  // Only run if we're in a browser extension context
  if (typeof chrome === 'undefined' && typeof browser === 'undefined') {
    return;
  }

  // If browser API exists (Firefox), create chrome compatibility layer
  if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
    window.chrome = browser;
  }

  // If chrome API exists but browser doesn't (Chrome), create browser compatibility layer
  if (typeof chrome !== 'undefined' && typeof browser === 'undefined') {
    window.browser = chrome;
  }

  // Ensure both APIs are available globally
  if (typeof globalThis !== 'undefined') {
    if (typeof browser !== 'undefined') {
      globalThis.browser = browser;
      globalThis.chrome = browser; // Make chrome point to browser API in Firefox
    }
    if (typeof chrome !== 'undefined') {
      globalThis.chrome = chrome;
      globalThis.browser = chrome; // Make browser point to chrome API in Chrome
    }
  }
})();