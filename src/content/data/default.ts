// This file previously contained default emoji groups for content scripts,
// but it's no longer needed since:
// 1. Content scripts load data from background via loadDataFromStorage()
// 2. The ensureDefaultIfEmpty() function that used this was redundant and buggy
// 3. Default settings are centralized in @/types/defaultSettings

// This file is kept for potential future use but is currently not imported anywhere.
