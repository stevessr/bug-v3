import './main.ts'


import { setupOnInstalledListener } from '../init.ts'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './handlers.ts'

console.log('Emoji Extension Background script loaded.')

// Wire up listeners and periodic jobs
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()
