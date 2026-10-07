declare global {
  const __ENABLE_LOGGING__: boolean
  const __ENABLE_FORUM_BROWSER__: boolean
  const __ENABLE_LOCAL_MCP_BRIDGE__: boolean
  const __APP_GIT_HISTORY__: Array<{ hash: string; date: string; subject: string }>
}

export {}
