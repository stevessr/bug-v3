# Implementation Plan: Emoji Management Chrome Extension

This document outlines the implementation tasks for creating the Emoji Management Chrome extension. The tasks are designed to be executed sequentially by a code-generation LLM, following a test-driven approach where applicable.

## 1. Project Setup

-   [ ] **1.1. Initialize Project Structure**
    -   Create a new Vite project with a Vue template.
    -   Set up the necessary directory structure: `background/`, `content/`, `options/`, `public/`.
    -   Create the `manifest.json` file.
    -   **References:** Design - 2. Architecture

-   [ ] **1.2. Configure `manifest.json`**
    -   Define `manifest_version`, `name`, `version`, and `description`.
    -   Set up the `background` script entry.
    -   Configure the `options_page` entry.
    -   Define the `content_scripts` to run on all pages.
    -   Request necessary `permissions`: `storage`, `activeTab`, `scripting`.
    -   **References:** Design - 7. Build Process

-   [ ] **1.3. Install Dependencies**
    -   Install `ant-design-vue` for UI components.
    -   Install a library for generating UUIDs (e.g., `uuid`).
    -   **References:** Design - 3. Components and Interfaces

## 2. Background Script

-   [ ] **2.1. Implement Data Storage**
    -   Create `background/main.js`.
    -   Implement functions to get and set emoji data using `chrome.storage.local`.
    -   Initialize default data if none exists on extension installation (`chrome.runtime.onInstalled`).
    -   **References:** Design - 4. Data Models; Requirements - 2.3

-   [ ] **2.2. Set up Message Listeners**
    -   Add listeners in the background script (`chrome.runtime.onMessage`) to handle data requests from the options page and content script.
    -   Create handlers for actions like `getEmojiGroups`, `saveEmojiGroups`.
    -   **References:** Design - 2. Architecture

## 3. Options Page (Vue + Ant Design)

-   [ ] **3.1. Create Basic Options UI**
    -   Set up the main `options/App.vue` component.
    -   Implement the basic layout using Ant Design components.
    -   Create a communication service (`options/chrome-api.js`) to message the background script.
    -   Fetch and display emoji groups when the page loads.
    -   **References:** Design - 3.2. Options Page Components

-   [ ] **3.2. Implement Emoji Group Management**
    -   Create the `EmojiGroupManager.vue` component.
    -   Implement functionality to add a new group.
    -   Implement functionality to rename an existing group.
    -   Implement functionality to delete a group (with a confirmation dialog).
    -   **References:** Requirements - 2.2. AC2

-   [ ] **3.3. Implement Emoji List Management**
    -   Create the `EmojiList.vue` and `EditEmojiModal.vue` components.
    -   Display emojis for a selected group.
    -   Implement functionality to add a new emoji (name, URL) via a modal.
    -   Implement functionality to edit an existing emoji.
    -   Implement functionality to delete an emoji.
    -   **References:** Requirements - 2.2. AC3

## 4. Content Script

-   [ ] **4.1. Implement Injection Logic**
    -   In `content/main.js`, write code to detect `<textarea>` and `contenteditable` elements.
    -   Create and append a trigger button next to detected elements.
    -   **References:** Requirements - 2.1. AC1

-   [ ] **4.2. Create Emoji Picker Component**
    -   Create the `content/EmojiPicker.vue` component.
    -   The component should fetch emoji data from the background script.
    -   Render the emoji groups and emojis in a grid layout.
    -   **References:** Requirements - 2.1. AC3

-   [ ] **4.3. Implement Picker Functionality**
    -   When the trigger button is clicked, mount and display the `EmojiPicker.vue` component.
    -   When an emoji is selected, insert its markdown/image representation into the target text field.
    -   Close the picker after selection or when clicking outside.
    -   **References:** Requirements - 2.1. AC2, 2.1. AC4, 2.1. AC5
