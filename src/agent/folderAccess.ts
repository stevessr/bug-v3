import type {
  AgentActionResult,
  AgentFolderRoot,
  AgentSettings,
  ListFilesAction,
  ReadFileAction,
  WriteFileAction
} from './types'

const DB_NAME = 'ai-agent-folder-access-v1'
const DB_VERSION = 1
const HANDLE_STORE = 'directory-handles'
const DEFAULT_LIST_LIMIT = 80
const MAX_LIST_LIMIT = 300
const DEFAULT_READ_BYTES = 128 * 1024
const MAX_READ_BYTES = 512 * 1024

type FolderHandleRecord = {
  id: string
  handle: FileSystemDirectoryHandle
  updatedAt: number
}

type FolderPermissionMode = 'read' | 'readwrite'

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string
    mode?: FolderPermissionMode
  }) => Promise<FileSystemDirectoryHandle>
}

type DirectoryHandleWithPermissions = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: FolderPermissionMode }) => Promise<FolderPermissionState>
  requestPermission?: (descriptor: { mode: FolderPermissionMode }) => Promise<FolderPermissionState>
  entries?: () => AsyncIterableIterator<[string, { kind: 'file' | 'directory' } & FileSystemHandle]>
}

export type FolderPermissionState = PermissionState | 'missing' | 'unsupported'

export type FolderRootState = {
  available: boolean
  permission: FolderPermissionState
  handleName?: string
  error?: string
}

type FolderAction = ListFilesAction | ReadFileAction | WriteFileAction

const supportsDirectoryPermissions = (handle: FileSystemDirectoryHandle) =>
  typeof (handle as DirectoryHandleWithPermissions).queryPermission === 'function'

export const supportsAgentFolderAccess = () =>
  typeof indexedDB !== 'undefined' &&
  typeof window !== 'undefined' &&
  'showDirectoryPicker' in window

const openHandleDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open folder handle DB'))
  })

const runHandleStore = async <T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T> | T
) => {
  const db = await openHandleDb()
  try {
    const tx = db.transaction(HANDLE_STORE, mode)
    const store = tx.objectStore(HANDLE_STORE)
    const result = await runner(store)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error('Folder handle transaction failed'))
      tx.onabort = () => reject(tx.error || new Error('Folder handle transaction aborted'))
    })
    return result
  } finally {
    db.close()
  }
}

const idbRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

const isAbsoluteLikePath = (value: string) => {
  const trimmed = value.trim()
  return trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(trimmed)
}

const normalizePathSegments = (path: string | undefined, allowEmpty = true) => {
  const input = (path || '').trim()
  if (input && isAbsoluteLikePath(input)) {
    throw new Error('路径必须是相对路径，不能使用绝对路径')
  }

  const raw = input.replace(/\\/g, '/')
  if (!raw) {
    if (allowEmpty) return []
    throw new Error('缺少相对路径')
  }

  const segments = raw.split('/').filter(Boolean)
  if (!allowEmpty && segments.length === 0) {
    throw new Error('缺少相对路径')
  }
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error('路径不能包含 . 或 ..')
    }
  }
  return segments
}

const queryHandlePermission = async (
  handle: FileSystemDirectoryHandle,
  mode: FolderPermissionMode
): Promise<FolderPermissionState> => {
  if (!supportsDirectoryPermissions(handle)) return 'granted'
  try {
    const queryPermission = (handle as DirectoryHandleWithPermissions).queryPermission
    if (!queryPermission) return 'granted'
    return await queryPermission.call(handle, { mode })
  } catch {
    return 'unsupported'
  }
}

const resolveFolderRoot = (
  action: { rootId?: string; rootAlias?: string },
  settings: AgentSettings
): AgentFolderRoot => {
  const enabledRoots = settings.folderRoots.filter(root => root.enabled)
  if (enabledRoots.length === 0) {
    throw new Error('未配置可访问的文件夹')
  }

  if (action.rootId) {
    const byId = enabledRoots.find(root => root.id === action.rootId)
    if (byId) return byId
  }

  if (action.rootAlias) {
    const byAlias = enabledRoots.find(root => root.alias === action.rootAlias)
    if (byAlias) return byAlias
  }

  if (enabledRoots.length === 1) {
    return enabledRoots[0]
  }

  throw new Error('存在多个已启用文件夹，请提供 rootAlias 或 rootId')
}

const resolveChildDirectory = async (
  rootHandle: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean
) => {
  let current = rootHandle
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create })
  }
  return current
}

const readDirectoryHandle = async (rootId: string) =>
  runHandleStore('readonly', async store => {
    const record = (await idbRequest(
      store.get(rootId) as IDBRequest<FolderHandleRecord | undefined>
    )) as FolderHandleRecord | undefined
    return record?.handle || null
  })

const writeDirectoryHandle = async (rootId: string, handle: FileSystemDirectoryHandle) =>
  runHandleStore('readwrite', async store => {
    await idbRequest(
      store.put({
        id: rootId,
        handle,
        updatedAt: Date.now()
      } as FolderHandleRecord)
    )
  })

export const removeAgentFolderHandle = async (rootId: string) =>
  runHandleStore('readwrite', async store => {
    await idbRequest(store.delete(rootId))
  })

export const pickAgentFolderRoot = async (rootId: string, mode: FolderPermissionMode = 'read') => {
  if (!supportsAgentFolderAccess()) {
    throw new Error('当前环境不支持手动选择文件夹')
  }

  const showDirectoryPicker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!showDirectoryPicker) {
    throw new Error('当前环境不支持手动选择文件夹')
  }

  const handle = await showDirectoryPicker({
    id: `agent-folder-${rootId}`,
    mode
  })
  const requestPermission = (handle as DirectoryHandleWithPermissions).requestPermission
  const permission =
    typeof requestPermission === 'function'
      ? await requestPermission.call(handle, { mode })
      : 'granted'

  await writeDirectoryHandle(rootId, handle)
  return {
    handleName: handle.name,
    permission: permission as FolderPermissionState
  }
}

export const requestAgentFolderPermission = async (rootId: string, mode: FolderPermissionMode) => {
  const handle = await readDirectoryHandle(rootId)
  if (!handle) {
    return { handleName: '', permission: 'missing' as FolderPermissionState }
  }
  const requestPermission = (handle as DirectoryHandleWithPermissions).requestPermission
  const permission =
    typeof requestPermission === 'function'
      ? await requestPermission.call(handle, { mode })
      : 'granted'

  return {
    handleName: handle.name,
    permission: permission as FolderPermissionState
  }
}

export const getAgentFolderRootState = async (root: AgentFolderRoot): Promise<FolderRootState> => {
  if (!supportsAgentFolderAccess()) {
    return {
      available: false,
      permission: 'unsupported',
      handleName: root.handleName
    }
  }

  const handle = await readDirectoryHandle(root.id)
  if (!handle) {
    return {
      available: false,
      permission: 'missing',
      handleName: root.handleName
    }
  }

  const permission = await queryHandlePermission(handle, root.readOnly ? 'read' : 'readwrite')
  return {
    available: true,
    permission,
    handleName: handle.name
  }
}

const listFolderEntries = async (
  root: AgentFolderRoot,
  handle: FileSystemDirectoryHandle,
  action: ListFilesAction
) => {
  const directory = await resolveChildDirectory(
    handle,
    normalizePathSegments(action.path, true),
    false
  )
  const recursive = action.recursive === true
  const maxEntries = clampInteger(action.maxEntries, DEFAULT_LIST_LIMIT, 1, MAX_LIST_LIMIT)
  const queue: Array<{ handle: FileSystemDirectoryHandle; segments: string[] }> = [
    { handle: directory, segments: normalizePathSegments(action.path, true) }
  ]
  const entries: Array<{ name: string; kind: 'file' | 'directory'; path: string }> = []
  let truncated = false

  while (queue.length > 0 && entries.length < maxEntries) {
    const current = queue.shift()
    if (!current) break

    const iterator = (current.handle as DirectoryHandleWithPermissions).entries?.()
    if (!iterator) {
      throw new Error('当前环境不支持目录枚举')
    }

    for await (const [name, entryHandle] of iterator) {
      const entryPath = [...current.segments, name].join('/')
      entries.push({
        name,
        kind: entryHandle.kind,
        path: entryPath
      })

      if (entryHandle.kind === 'directory' && recursive && entries.length < maxEntries) {
        queue.push({
          handle: entryHandle as FileSystemDirectoryHandle,
          segments: [...current.segments, name]
        })
      }

      if (entries.length >= maxEntries) {
        truncated = true
        break
      }
    }
  }

  return {
    rootId: root.id,
    rootAlias: root.alias,
    path: normalizePathSegments(action.path, true).join('/'),
    entries,
    truncated
  }
}

const readFolderFile = async (
  root: AgentFolderRoot,
  handle: FileSystemDirectoryHandle,
  action: ReadFileAction
) => {
  const segments = normalizePathSegments(action.path, false)
  const parent = await resolveChildDirectory(handle, segments.slice(0, -1), false)
  const fileHandle = await parent.getFileHandle(segments[segments.length - 1])
  const file = await fileHandle.getFile()
  const maxBytes = clampInteger(action.maxBytes, DEFAULT_READ_BYTES, 1024, MAX_READ_BYTES)
  const content = await file.slice(0, maxBytes).text()

  return {
    rootId: root.id,
    rootAlias: root.alias,
    path: segments.join('/'),
    size: file.size,
    truncated: file.size > maxBytes,
    content
  }
}

const writeFolderFile = async (
  root: AgentFolderRoot,
  handle: FileSystemDirectoryHandle,
  action: WriteFileAction
) => {
  if (root.readOnly) {
    throw new Error(`文件夹 ${root.alias} 当前为只读`)
  }

  const permission = await queryHandlePermission(handle, 'readwrite')
  if (permission !== 'granted') {
    throw new Error(`文件夹 ${root.alias} 未授予写入权限，请先在设置中重新授权`)
  }

  const segments = normalizePathSegments(action.path, false)
  const parent = await resolveChildDirectory(
    handle,
    segments.slice(0, -1),
    action.createParents !== false
  )
  const fileName = segments[segments.length - 1]

  if (action.overwrite === false) {
    try {
      await parent.getFileHandle(fileName)
      throw new Error(`文件 ${segments.join('/')} 已存在`)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        throw error
      }
    }
  }

  const fileHandle = await parent.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(action.content)
  await writable.close()

  return {
    rootId: root.id,
    rootAlias: root.alias,
    path: segments.join('/'),
    bytesWritten: new Blob([action.content]).size
  }
}

export const executeFolderAction = async (
  action: FolderAction,
  settings: AgentSettings
): Promise<AgentActionResult> => {
  try {
    const root = resolveFolderRoot(action, settings)
    const handle = await readDirectoryHandle(root.id)
    if (!handle) {
      throw new Error(`文件夹 ${root.alias} 尚未授权或句柄已失效`)
    }

    const readPermission = await queryHandlePermission(handle, 'read')
    if (readPermission !== 'granted') {
      throw new Error(`文件夹 ${root.alias} 未授予读取权限，请先在设置中重新授权`)
    }

    let data: unknown
    if (action.type === 'list-files') {
      data = await listFolderEntries(root, handle, action)
    } else if (action.type === 'read-file') {
      data = await readFolderFile(root, handle, action)
    } else {
      data = await writeFolderFile(root, handle, action)
    }

    return {
      id: action.id,
      type: action.type,
      success: true,
      data
    }
  } catch (error) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      error: error instanceof Error ? error.message : '文件夹访问失败'
    }
  }
}
