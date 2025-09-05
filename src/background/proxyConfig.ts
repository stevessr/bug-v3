export interface ProxyConfig {
  enabled: boolean
  url: string // e.g. https://pixiv-proxy.workers.dev
  password?: string
}

// Default config (disabled). The extension's background can expose UI to change this
export const defaultProxyConfig: ProxyConfig = {
  enabled: false,
  url: '',
  password: ''
}
