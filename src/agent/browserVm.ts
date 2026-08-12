import { nanoid } from 'nanoid'

import type { AgentTool } from './aiTypes'
import type { AgentAction, AgentPermissions, AgentSettings } from './types'

/**
 * Browser VM operation contract.
 *
 * This is intentionally a small capability VM rather than an eval bridge. The
 * linear memory is a real WebAssembly.Memory instance and the virtual file
 * store is backed by that memory; no host filesystem module is imported or
 * exposed to extension pages.
 */
export type BrowserVmOperation =
  | 'inspect'
  | 'query'
  | 'click'
  | 'double-click'
  | 'hover'
  | 'focus'
  | 'input'
  | 'scroll'
  | 'screenshot'
  | 'tabs'
  | 'open-tab'
  | 'activate-tab'
  | 'navigate'
  | 'wait'
  | 'snapshot'
  | 'list-files'
  | 'read-file'
  | 'write-file'

export type BrowserVmRequest = {
  instanceId?: string
  operation: BrowserVmOperation
  selector?: string
  text?: string
  url?: string
  tabId?: number
  ms?: number
  x?: number
  y?: number
  behavior?: 'auto' | 'smooth'
  format?: 'png' | 'jpeg'
  path?: string
  content?: string
  includeMarkdown?: boolean
  recursive?: boolean
  maxEntries?: number
  waitForLoad?: boolean
}

export type BrowserVmResult = {
  instanceId: string
  operation: BrowserVmOperation
  success: boolean
  data?: unknown
  error?: string
  memoryBytes: number
}

type VmFile = {
  offset: number
  byteLength: number
  updatedAt: number
}

const instances = new Map<string, BrowserVmInstance>()

const normalizePath = (path: string | undefined): string => {
  const value = (path || '/').trim().replace(/\\/g, '/')
  if (!value || value === '/') return '/'
  const parts = value.split('/').filter(Boolean)
  if (parts.some(part => part === '..')) throw new Error('虚拟路径不能包含 ..')
  return `/${parts.join('/')}`
}

const createMemory = () => {
  if (typeof WebAssembly === 'undefined') {
    throw new Error('当前浏览器不支持 WebAssembly，无法创建浏览器 VM')
  }
  return new WebAssembly.Memory({ initial: 2, maximum: 64 })
}

export class BrowserVmInstance {
  readonly id: string
  readonly memory: WebAssembly.Memory
  private readonly files = new Map<string, VmFile>()
  private nextOffset = 0

  constructor(id = nanoid()) {
    this.id = id
    this.memory = createMemory()
  }

  private writeMemory(content: string): { offset: number; byteLength: number } {
    const bytes = new TextEncoder().encode(content)
    const required = this.nextOffset + bytes.byteLength
    const current = this.memory.buffer.byteLength
    if (required > current) {
      const pages = Math.ceil((required - current) / 65_536)
      try {
        this.memory.grow(Math.max(1, pages))
      } catch {
        throw new Error('浏览器 VM 虚拟内存不足')
      }
    }
    new Uint8Array(this.memory.buffer, this.nextOffset, bytes.byteLength).set(bytes)
    const result = { offset: this.nextOffset, byteLength: bytes.byteLength }
    this.nextOffset += bytes.byteLength
    return result
  }

  private writeFile(path: string, content: string): VmFile {
    const placement = this.writeMemory(content)
    const file: VmFile = { ...placement, updatedAt: Date.now() }
    this.files.set(path, file)
    return file
  }

  private readMemory(file: VmFile): string {
    return new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, file.offset, file.byteLength)
    )
  }

  private listFiles(path: string, recursive: boolean, maxEntries: number) {
    const prefix = path === '/' ? '/' : `${path}/`
    return [...this.files.entries()]
      .filter(([filePath]) => filePath.startsWith(prefix))
      .filter(([filePath]) => recursive || !filePath.slice(prefix.length).includes('/'))
      .slice(0, maxEntries)
      .map(([filePath, file]) => ({
        path: filePath,
        byteLength: file.byteLength,
        updatedAt: file.updatedAt
      }))
  }

  /** Virtual filesystem primitives for browser-side script skills. */
  readVirtualFile(path?: string): {
    path: string
    content: string
    byteLength: number
    offset: number
  } {
    const normalized = normalizePath(path)
    const file = this.files.get(normalized)
    if (!file) throw new Error(`虚拟文件不存在：${normalized}`)
    return {
      path: normalized,
      content: this.readMemory(file),
      byteLength: file.byteLength,
      offset: file.offset
    }
  }

  writeVirtualFile(
    path: string | undefined,
    content: string
  ): {
    path: string
    byteLength: number
    offset: number
  } {
    const normalized = normalizePath(path)
    const file = this.writeFile(normalized, content)
    return { path: normalized, byteLength: file.byteLength, offset: file.offset }
  }

  /** Release this instance and its linear-memory-backed virtual files. */
  dispose(): void {
    this.files.clear()
    this.nextOffset = 0
    instances.delete(this.id)
  }

  listVirtualFiles(path?: string, recursive = false, maxEntries = 200) {
    return this.listFiles(normalizePath(path), recursive, Math.min(maxEntries, 500))
  }

  private async runAction(
    request: BrowserVmRequest,
    permissions: AgentPermissions,
    settings: AgentSettings,
    targetTabId?: number
  ): Promise<unknown> {
    const { executeAgentActions } = await import('./executeActions')
    const id = nanoid()
    let action: AgentAction
    switch (request.operation) {
      case 'inspect':
      case 'query':
        action = {
          id,
          type: 'getDOM',
          selector: request.selector,
          options: { includeMarkdown: request.includeMarkdown ?? true }
        } as AgentAction
        break
      case 'click':
      case 'double-click':
      case 'hover':
      case 'focus':
        action = {
          id,
          type: request.operation,
          selector: request.selector,
          x: request.x,
          y: request.y
        } as AgentAction
        break
      case 'input':
        action = {
          id,
          type: 'input',
          selector: request.selector || '',
          text: request.text || ''
        }
        break
      case 'scroll':
        action = {
          id,
          type: 'scroll',
          x: request.x,
          y: request.y,
          behavior: request.behavior || 'auto'
        }
        break
      case 'screenshot':
        action = { id, type: 'screenshot', format: request.format || 'png' }
        break
      case 'tabs':
        action = { id, type: 'list-tabs' }
        break
      case 'open-tab':
        action = {
          id,
          type: 'open-tab',
          url: request.url || 'about:blank',
          active: true,
          waitForLoad: request.waitForLoad
        } as AgentAction
        break
      case 'activate-tab':
        action = { id, type: 'activate-tab', tabId: request.tabId } as AgentAction
        break
      case 'navigate':
        action = {
          id,
          type: 'navigate',
          url: request.url || '',
          waitForLoad: request.waitForLoad
        }
        break
      case 'wait':
        action = {
          id,
          type: 'wait',
          ms: Math.min(Math.max(Number(request.ms ?? request.text ?? 0), 0), 30_000)
        } as AgentAction
        break
      default:
        throw new Error(`不支持的浏览器 VM 操作：${request.operation}`)
    }
    const [result] = await executeAgentActions([action], permissions, targetTabId, { settings })
    if (!result?.success) throw new Error(result?.error || '浏览器 VM 操作失败')
    return result.data
  }

  async operate(
    request: BrowserVmRequest,
    permissions: AgentPermissions,
    settings: AgentSettings,
    targetTabId?: number
  ): Promise<BrowserVmResult> {
    try {
      if (request.operation === 'snapshot') {
        return {
          instanceId: this.id,
          operation: request.operation,
          success: true,
          data: {
            memoryBytes: this.memory.buffer.byteLength,
            usedBytes: this.nextOffset,
            files: this.listFiles('/', true, 500)
          },
          memoryBytes: this.memory.buffer.byteLength
        }
      }
      if (request.operation === 'list-files') {
        const path = normalizePath(request.path)
        return {
          instanceId: this.id,
          operation: request.operation,
          success: true,
          data: this.listFiles(
            path,
            request.recursive === true,
            Math.min(request.maxEntries || 200, 500)
          ),
          memoryBytes: this.memory.buffer.byteLength
        }
      }
      if (request.operation === 'read-file') {
        const file = this.readVirtualFile(request.path)
        return {
          instanceId: this.id,
          operation: request.operation,
          success: true,
          data: file,
          memoryBytes: this.memory.buffer.byteLength
        }
      }
      if (request.operation === 'write-file') {
        const file = this.writeVirtualFile(request.path, request.content || '')
        return {
          instanceId: this.id,
          operation: request.operation,
          success: true,
          data: file,
          memoryBytes: this.memory.buffer.byteLength
        }
      }
      const data = await this.runAction(request, permissions, settings, targetTabId)
      return {
        instanceId: this.id,
        operation: request.operation,
        success: true,
        data,
        memoryBytes: this.memory.buffer.byteLength
      }
    } catch (error) {
      return {
        instanceId: this.id,
        operation: request.operation,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        memoryBytes: this.memory.buffer.byteLength
      }
    }
  }
}

/** Short name used by integrations that treat the instance as a WASM VM. */
export const WasmVm = BrowserVmInstance

export const getBrowserVmInstance = (instanceId?: string): BrowserVmInstance => {
  if (instanceId) {
    const existing = instances.get(instanceId)
    if (existing) return existing
  }
  const instance = new BrowserVmInstance(instanceId)
  instances.set(instance.id, instance)
  return instance
}

export const browserVmToolSchema: Record<string, unknown> = {
  type: 'object',
  required: ['operation'],
  properties: {
    instanceId: { type: 'string', description: '可复用的浏览器 VM 实例 id' },
    operation: {
      type: 'string',
      enum: [
        'inspect',
        'query',
        'click',
        'double-click',
        'hover',
        'focus',
        'input',
        'scroll',
        'screenshot',
        'tabs',
        'open-tab',
        'activate-tab',
        'navigate',
        'wait',
        'snapshot',
        'list-files',
        'read-file',
        'write-file'
      ]
    },
    selector: { type: 'string' },
    text: { type: 'string' },
    url: { type: 'string' },
    tabId: { type: 'number' },
    ms: { type: 'number', description: 'wait 操作的毫秒数（上限 30000）' },
    x: { type: 'number' },
    y: { type: 'number' },
    behavior: { type: 'string', enum: ['auto', 'smooth'] },
    format: { type: 'string', enum: ['png', 'jpeg'] },
    path: { type: 'string' },
    content: { type: 'string' },
    includeMarkdown: { type: 'boolean' },
    recursive: { type: 'boolean' },
    maxEntries: { type: 'number' },
    waitForLoad: { type: 'boolean' }
  }
}

export const createBrowserVmTool = (options: {
  permissions: AgentPermissions
  settings: AgentSettings
  targetTabId?: number
}): AgentTool<BrowserVmRequest, { kind: 'browser-vm'; result: BrowserVmResult }> => ({
  name: 'browser_vm',
  label: 'Browser VM',
  description:
    '在浏览器内 WASM VM 实例中 inspect/query 页面、执行受权限控制的浏览器动作，并读写 VM 虚拟文件。不能访问宿主文件系统或执行任意脚本。',
  parameters: browserVmToolSchema,
  execute: async (_toolCallId, params) => {
    const request = params as BrowserVmRequest
    if (!request?.operation) throw new Error('browser_vm 缺少 operation')
    const result = await getBrowserVmInstance(request.instanceId).operate(
      request,
      options.permissions,
      options.settings,
      request.tabId ?? options.targetTabId
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      details: { kind: 'browser-vm', result },
      isError: !result.success
    }
  }
})
