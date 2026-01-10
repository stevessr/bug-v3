import './utils/main.ts'

import { setupOnInstalledListener, setupSidePanel } from './init'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './utils/handlers'

console.log('Emoji Extension Background script loaded.')

// Wire up listeners and periodic jobs
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// Configure side panel at window level on every background script load
// This ensures the side panel doesn't reload when switching tabs
setupSidePanel()
