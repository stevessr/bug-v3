export interface ProxyConfig {
  enabled: boolean
  url: string
  password?: string
}

export const defaultProxyConfig: ProxyConfig = {
  enabled: false,
  url: '',
  password: ''
}
