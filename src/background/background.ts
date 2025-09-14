import './utils/main.ts'

import { setupOnInstalledListener } from './init'
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
