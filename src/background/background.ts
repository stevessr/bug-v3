import './utils';
import { setupOnInstalledListener } from './init';
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './handlers';

console.log('Emoji Extension Background script loaded.');

// Wire up listeners and periodic jobs
setupOnInstalledListener();
setupMessageListener();
setupStorageChangeListener();
setupContextMenu();
setupPeriodicCleanup();

