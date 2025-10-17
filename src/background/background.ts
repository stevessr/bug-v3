import './utils/main.ts'

import { setupOnInstalledListener } from './init'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './utils/handlers'
import { setupCalloutInjection, setupTabCleanup } from './handlers/calloutInjection'

console.log('Emoji Extension Background script loaded.')

// Wire up listeners and periodic jobs
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// Setup callout suggestions injection
setupCalloutInjection()
setupTabCleanup()
