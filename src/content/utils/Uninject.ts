import { initXhs } from '../xhs/init'

// logger removed: replaced by direct console usage in migration

// NOTE: Platform-specific scripts (X, Pixiv, Bilibili, Reddit) have been moved to
// standalone scripts and are now injected by content script requests.
// Only XHS (小红书) remains here as it hasn't been migrated yet.

export function Uninject() {
  // Most platform initializations have been moved to standalone scripts
  // and are now injected via content.ts -> background -> platform scripts

  // Only XHS init remains for now
  try {
    initXhs()
  } catch (xhsErr) {
    console.error('[XhsOneClick] initXhs failed', xhsErr)
  }

  console.log('[Uninject] Platform-specific scripts are now injected via standalone modules')
}
