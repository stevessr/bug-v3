/**
 * MCP UI - 实验性 UI 特性支持
 * 支持 MCP Elicitation (用户输入表单) 和 MCP Apps (交互式 UI)
 */

import type { McpServerConfig } from './types'

// ============ MCP Elicitation Types ============

export interface ElicitationSchema {
  type: 'object'
  properties: Record<string, ElicitationPropertySchema>
  required?: string[]
}

export type ElicitationPropertySchema =
  | StringPropertySchema
  | NumberPropertySchema
  | BooleanPropertySchema
  | EnumPropertySchema
  | MultiSelectPropertySchema

export interface StringPropertySchema {
  type: 'string'
  title?: string
  description?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'uri' | 'date' | 'date-time'
  default?: string
  enum?: string[]
}

export interface NumberPropertySchema {
  type: 'number' | 'integer'
  title?: string
  description?: string
  minimum?: number
  maximum?: number
  default?: number
}

export interface BooleanPropertySchema {
  type: 'boolean'
  title?: string
  description?: string
  default?: boolean
}

export interface EnumPropertySchema {
  type: 'string'
  title?: string
  description?: string
  enum?: string[]
  oneOf?: Array<{ const: string; title: string }>
  default?: string
}

export interface MultiSelectPropertySchema {
  type: 'array'
  title?: string
  description?: string
  minItems?: number
  maxItems?: number
  items: {
    type?: 'string'
    enum?: string[]
    anyOf?: Array<{ const: string; title: string }>
  }
  default?: string[]
}

export interface ElicitationRequest {
  mode?: 'form'
  message: string
  requestedSchema?: ElicitationSchema
}

export interface ElicitationResponse {
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

// ============ MCP Apps Types ============

export interface McpAppMeta {
  ui?: {
    resourceUri: string
  }
}

export interface McpToolWithUI {
  name: string
  description?: string
  inputSchema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
  _meta?: McpAppMeta
}

export interface McpAppResource {
  uri: string
  mimeType: string
  text?: string
  blob?: string
}

export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app'

// ============ Elicitation Handlers ============

// 待处理的 elicitation 请求队列
const pendingElicitations = new Map<
  string,
  {
    request: ElicitationRequest
    resolve: (response: ElicitationResponse) => void
    reject: (error: Error) => void
    serverId: string
    serverName: string
  }
>()

// Elicitation 请求监听器
let elicitationHandler:
  | ((request: {
      id: string
      serverId: string
      serverName: string
      request: ElicitationRequest
    }) => void)
  | null = null

/**
 * 设置 elicitation 请求处理器
 * UI 层调用此方法来接收 elicitation 请求并显示表单
 */
export function setElicitationHandler(
  handler:
    | ((request: {
        id: string
        serverId: string
        serverName: string
        request: ElicitationRequest
      }) => void)
    | null
) {
  elicitationHandler = handler
}

/**
 * 处理来自 MCP 服务器的 elicitation 请求
 */
export function handleElicitationRequest(
  serverId: string,
  serverName: string,
  request: ElicitationRequest
): Promise<ElicitationResponse> {
  return new Promise((resolve, reject) => {
    const id = `elicit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    pendingElicitations.set(id, {
      request,
      resolve,
      reject,
      serverId,
      serverName
    })

    // 通知 UI 层显示表单
    if (elicitationHandler) {
      elicitationHandler({ id, serverId, serverName, request })
    } else {
      // 如果没有处理器，返回取消
      console.warn('[MCP UI] No elicitation handler registered, declining request')
      resolve({ action: 'decline' })
      pendingElicitations.delete(id)
    }

    // 设置超时
    setTimeout(
      () => {
        if (pendingElicitations.has(id)) {
          pendingElicitations.delete(id)
          resolve({ action: 'cancel' })
        }
      },
      5 * 60 * 1000
    ) // 5 分钟超时
  })
}

/**
 * 响应 elicitation 请求
 * UI 层调用此方法提交用户填写的表单数据
 */
export function respondToElicitation(id: string, response: ElicitationResponse): boolean {
  const pending = pendingElicitations.get(id)
  if (!pending) {
    console.warn('[MCP UI] No pending elicitation with id:', id)
    return false
  }

  pending.resolve(response)
  pendingElicitations.delete(id)
  return true
}

/**
 * 获取所有待处理的 elicitation 请求
 */
export function getPendingElicitations(): Array<{
  id: string
  serverId: string
  serverName: string
  request: ElicitationRequest
}> {
  return Array.from(pendingElicitations.entries()).map(([id, data]) => ({
    id,
    serverId: data.serverId,
    serverName: data.serverName,
    request: data.request
  }))
}

// ============ MCP Apps Handlers ============

/**
 * 检查工具是否有 UI 资源
 */
export function hasUIResource(tool: McpToolWithUI): boolean {
  return !!tool._meta?.ui?.resourceUri
}

/**
 * 获取工具的 UI 资源 URI
 */
export function getUIResourceUri(tool: McpToolWithUI): string | null {
  return tool._meta?.ui?.resourceUri || null
}

/**
 * 从 MCP 服务获取 UI 资源
 */
export async function fetchUIResource(
  server: McpServerConfig,
  resourceUri: string
): Promise<McpAppResource | null> {
  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(server.headers || {})
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'resources/read',
        params: { uri: resourceUri }
      })
    })

    if (!response.ok) {
      console.warn('[MCP UI] Failed to fetch UI resource:', response.status)
      return null
    }

    const data = await response.json()
    if (data.error) {
      console.warn('[MCP UI] Error fetching UI resource:', data.error.message)
      return null
    }

    const contents = data.result?.contents
    if (!contents || contents.length === 0) {
      return null
    }

    return contents[0] as McpAppResource
  } catch (error) {
    console.warn('[MCP UI] Error fetching UI resource:', error)
    return null
  }
}

/**
 * 创建安全的 iframe 沙箱来渲染 MCP App
 */
export function createAppSandbox(
  resource: McpAppResource,
  container: HTMLElement,
  options?: {
    onMessage?: (message: unknown) => void
    width?: string
    height?: string
  }
): { iframe: HTMLIFrameElement; destroy: () => void } {
  const iframe = document.createElement('iframe')
  iframe.style.width = options?.width || '100%'
  iframe.style.height = options?.height || '400px'
  iframe.style.border = 'none'
  iframe.style.borderRadius = '8px'
  iframe.style.backgroundColor = '#fff'

  // 安全沙箱设置
  iframe.sandbox.add('allow-scripts')
  iframe.sandbox.add('allow-forms')
  // 不允许：allow-same-origin, allow-popups, allow-top-navigation

  // 创建 blob URL 来加载 HTML
  const html = resource.text || (resource.blob ? atob(resource.blob) : '')
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)
  iframe.src = blobUrl

  // 消息处理
  const messageHandler = (event: MessageEvent) => {
    // 验证消息来源
    if (event.source !== iframe.contentWindow) return

    if (options?.onMessage) {
      options.onMessage(event.data)
    }
  }

  window.addEventListener('message', messageHandler)
  container.appendChild(iframe)

  return {
    iframe,
    destroy: () => {
      window.removeEventListener('message', messageHandler)
      URL.revokeObjectURL(blobUrl)
      iframe.remove()
    }
  }
}

/**
 * 向 MCP App iframe 发送消息
 */
export function sendMessageToApp(iframe: HTMLIFrameElement, message: unknown): void {
  iframe.contentWindow?.postMessage(message, '*')
}

// ============ Schema 表单生成辅助 ============

export interface FormField {
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'email' | 'date' | 'datetime'
  label: string
  description?: string
  required: boolean
  default?: unknown
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  options?: Array<{ value: string; label: string }>
}

/**
 * 将 elicitation schema 转换为表单字段定义
 */
export function schemaToFormFields(schema: ElicitationSchema): FormField[] {
  const fields: FormField[] = []
  const required = new Set(schema.required || [])

  for (const [name, prop] of Object.entries(schema.properties)) {
    const field: FormField = {
      name,
      type: 'text',
      label: (prop as { title?: string }).title || name,
      description: (prop as { description?: string }).description,
      required: required.has(name),
      default: (prop as { default?: unknown }).default
    }

    if (prop.type === 'string') {
      const stringProp = prop as StringPropertySchema
      if (stringProp.format === 'email') {
        field.type = 'email'
      } else if (stringProp.format === 'date') {
        field.type = 'date'
      } else if (stringProp.format === 'date-time') {
        field.type = 'datetime'
      } else if (stringProp.enum) {
        field.type = 'select'
        field.options = stringProp.enum.map((v: string) => ({ value: v, label: v }))
      } else if ((prop as EnumPropertySchema).oneOf) {
        field.type = 'select'
        field.options = ((prop as EnumPropertySchema).oneOf ?? []).map(o => ({
          value: o.const,
          label: o.title
        }))
      } else {
        field.type = 'text'
        field.validation = {
          minLength: stringProp.minLength,
          maxLength: stringProp.maxLength,
          pattern: stringProp.pattern
        }
      }
    } else if (prop.type === 'number' || prop.type === 'integer') {
      const numProp = prop as NumberPropertySchema
      field.type = 'number'
      field.validation = {
        min: numProp.minimum,
        max: numProp.maximum
      }
    } else if (prop.type === 'boolean') {
      field.type = 'boolean'
    } else if (prop.type === 'array') {
      const arrayProp = prop as MultiSelectPropertySchema
      field.type = 'multiselect'
      if (arrayProp.items.enum) {
        field.options = arrayProp.items.enum.map(v => ({ value: v, label: v }))
      } else if (arrayProp.items.anyOf) {
        field.options = arrayProp.items.anyOf.map(o => ({
          value: o.const,
          label: o.title
        }))
      }
      field.validation = {
        min: arrayProp.minItems,
        max: arrayProp.maxItems
      }
    }

    fields.push(field)
  }

  return fields
}

/**
 * 验证表单数据是否符合 schema
 */
export function validateFormData(
  data: Record<string, unknown>,
  schema: ElicitationSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const required = new Set(schema.required || [])

  for (const [name, prop] of Object.entries(schema.properties)) {
    const value = data[name]

    // 检查必填
    if (required.has(name) && (value === undefined || value === null || value === '')) {
      errors[name] = '此字段为必填项'
      continue
    }

    if (value === undefined || value === null || value === '') continue

    // 类型检查
    if (prop.type === 'string') {
      const stringProp = prop as StringPropertySchema
      if (typeof value !== 'string') {
        errors[name] = '必须是文本'
        continue
      }
      if (stringProp.minLength && value.length < stringProp.minLength) {
        errors[name] = `最少 ${stringProp.minLength} 个字符`
      }
      if (stringProp.maxLength && value.length > stringProp.maxLength) {
        errors[name] = `最多 ${stringProp.maxLength} 个字符`
      }
      if (stringProp.pattern && !new RegExp(stringProp.pattern).test(value)) {
        errors[name] = '格式不正确'
      }
      if (stringProp.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[name] = '请输入有效的邮箱地址'
      }
    } else if (prop.type === 'number' || prop.type === 'integer') {
      const numProp = prop as NumberPropertySchema
      const numValue = Number(value)
      if (isNaN(numValue)) {
        errors[name] = '必须是数字'
        continue
      }
      if (numProp.minimum !== undefined && numValue < numProp.minimum) {
        errors[name] = `不能小于 ${numProp.minimum}`
      }
      if (numProp.maximum !== undefined && numValue > numProp.maximum) {
        errors[name] = `不能大于 ${numProp.maximum}`
      }
    } else if (prop.type === 'array') {
      const arrayProp = prop as MultiSelectPropertySchema
      if (!Array.isArray(value)) {
        errors[name] = '必须是数组'
        continue
      }
      if (arrayProp.minItems && value.length < arrayProp.minItems) {
        errors[name] = `至少选择 ${arrayProp.minItems} 项`
      }
      if (arrayProp.maxItems && value.length > arrayProp.maxItems) {
        errors[name] = `最多选择 ${arrayProp.maxItems} 项`
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
