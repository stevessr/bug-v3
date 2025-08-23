// Build-time flags for development and production
// These values are replaced at build time by Vite

declare global {
  const __ENABLE_LOGGING__: boolean;
  const __ENABLE_INDEXEDDB__: boolean;
}

// Runtime flags that can be set by build configuration
export const BUILD_FLAGS = {
  // 是否启用日志输出 (控制 console.log, console.warn, console.error)
  ENABLE_LOGGING: typeof __ENABLE_LOGGING__ !== 'undefined' ? __ENABLE_LOGGING__ : true,
  
  // 是否启用 IndexedDB 读写操作
  ENABLE_INDEXEDDB: typeof __ENABLE_INDEXEDDB__ !== 'undefined' ? __ENABLE_INDEXEDDB__ : true,
} as const;

// 日志包装器，根据编译期标志决定是否输出
export const logger = {
  log: (...args: any[]) => {
    if (BUILD_FLAGS.ENABLE_LOGGING) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (BUILD_FLAGS.ENABLE_LOGGING) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (BUILD_FLAGS.ENABLE_LOGGING) {
      console.error(...args);
    }
  },
  
  // 开发模式日志（只在开发环境下输出）
  dev: (...args: any[]) => {
    if (BUILD_FLAGS.ENABLE_LOGGING && process.env.NODE_ENV === 'development') {
      console.log('[DEV]', ...args);
    }
  }
};

// IndexedDB 操作包装器
export const indexedDBWrapper = {
  isEnabled: () => BUILD_FLAGS.ENABLE_INDEXEDDB,
  
  // 检查是否应该跳过 IndexedDB 操作
  shouldSkip: () => !BUILD_FLAGS.ENABLE_INDEXEDDB,
};
