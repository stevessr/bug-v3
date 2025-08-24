# Chrome Extension Design: Emoji Management

## 1. Overview

This document outlines the technical design for the Emoji Management Chrome extension. The extension will allow users to inject custom emojis into web pages and manage their emoji library via an options page. The architecture is based on standard Chrome extension components and will be built using Vue 3, Vite, and Ant Design of Vue.

## 2. Architecture

The extension will be composed of three main parts: a content script, a background service worker, and an options page.

- **Content Script (`content/`):** This script will be injected into web pages. It is responsible for DOM manipulation, such as detecting text areas, injecting the trigger button for the emoji picker, and displaying the picker UI. It will communicate with the background script to fetch emoji data.

- **Background Script (`background/`):** The central hub of the extension. It will run as a service worker to manage state and handle data persistence. All emoji data will be stored and retrieved using the `chrome.storage.local` API. It will listen for messages from both the content script and the options page.

- **Options Page (`options/`):** A standalone web page that serves as the user interface for managing emoji groups and individual emojis. It will be a Single Page Application (SPA) built with Vue 3 and Ant Design of Vue. It will interact with the background script to read and write emoji configurations.

## 3. Components and Interfaces

### 3.1. Content Script Components

- **`EmojiPicker.vue`**: A Vue component that renders the emoji selection grid.
  - **Props**: `emojiGroups` (Array) - The emoji data to display.
  - **Events**: `emoji-selected` (Object) - Fired when an emoji is clicked, passing the emoji data. `close-picker` - Fired when the picker should be closed.
- **Injection Logic (`content/main.js`)**: A script that finds focusable text elements on the page and injects a trigger button alongside them. It will also be responsible for mounting the `EmojiPicker.vue` component into the page's DOM when the trigger is activated.

### 3.2. Options Page Components (Vue 3 + Ant Design)

- **`App.vue`**: The main application component that lays out the options page.
- **`EmojiGroupManager.vue`**: A component to display, create, rename, and delete emoji groups.
  - Uses Ant Design components like `a-collapse`, `a-button`, and `a-modal`.
- **`EmojiList.vue`**: A component to display the emojis within a selected group.
  - Uses Ant Design's `a-list` and `a-card` to display emojis.
- **`EditEmojiModal.vue`**: A modal form (using `a-modal` and `a-form`) for adding or editing an emoji's name and URL.

## 4. Data Models

The emoji data will be stored in `chrome.storage.local` under a single key, `emojiManagerData`. The data structure will be as follows:

```json
{
  "emojiGroups": [
    {
      "id": "c2a7c4e5-95b6-4c4f-8a8b-3e5f1b1d6e1a",
      "name": "Default Emojis",
      "emojis": [
        {
          "id": "e8d6c1b3-4e42-4f1a-9f5b-8c7a6e9d0f2c",
          "name": "Happy",
          "url": "https://example.com/happy.png"
        },
        {
          "id": "f3b4a2e1-9d8c-4a7b-8e6d-5c1d4e3f2b1a",
          "name": "Sad",
          "url": "https://example.com/sad.png"
        }
      ]
    }
  ]
}
```

- Each group and emoji will have a unique ID (UUID) for stable referencing.

## 5. Error Handling

- **Invalid URL**: The options page will include form validation to ensure that submitted URLs are in a valid format.
- **Storage Errors**: All calls to `chrome.storage` will be wrapped in `try...catch` blocks to handle potential quota limits or other storage-related errors. Feedback will be provided to the user via Ant Design's notification component.
- **Messaging Errors**: Communication between the content script/options page and the background script will check `chrome.runtime.lastError` to handle cases where the receiving end is not available.

## 6. Testing Strategy

- **Unit Testing**: Vitest can be used to test the data manipulation logic within the options page (e.g., adding/removing emojis from the data structure).
- **End-to-End (E2E) Testing**: Manual testing will be performed by loading the extension into Chrome.
  1.  Test adding, editing, and deleting emoji groups and emojis on the options page.
  2.  Verify data persistence by reloading the options page and the browser.
  3.  Test the content script by navigating to various websites, focusing on text fields, opening the picker, and inserting an emoji.

## 7. Build Process

- **Vite**: The project will be set up using Vite for a fast development experience.
- **Rolldown**: While Vite currently uses Rollup, the project structure will be compatible with Rolldown when it becomes the default bundler in Vite.
- **Manifest**: A `manifest.json` file will be configured to define the content scripts, background script, options page, and necessary permissions (`storage`, `activeTab`, `scripting`).
