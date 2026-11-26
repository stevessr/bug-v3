import type { Ref } from 'vue'

/**
 * 文件持久化 Composable
 * 使用 IndexedDB 存储文件，避免 localStorage 配额限制；
 * 复用数据库连接、防抖并按 ID 增量同步，避免队列增删时 O(N²) 全量重写。
 */

const DB_NAME = 'buffer-files-db'
const DB_VERSION = 1
const STORE_NAME = 'selected-files'
const SERIALIZE_CONCURRENCY = 8

export interface FileItem {
  id: string
  file: File
  previewUrl: string
  width?: number
  height?: number
  cropData?: { x: number; y: number; width: number; height: number }
  /** Target group for folder imports; ordinary uploads leave this unset. */
  targetGroupId?: string
}

interface SerializableFile {
  id: string
  fileName: string
  fileType: string
  fileData: ArrayBuffer
  width?: number
  height?: number
  cropData?: { x: number; y: number; width: number; height: number }
  targetGroupId?: string
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const runWorker = async () => {
    while (true) {
      const idx = nextIndex++
      if (idx >= items.length) return
      results[idx] = await worker(items[idx])
    }
  }
  const count = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: count }, () => runWorker()))
  return results
}

export function useFilePersistence(selectedFiles: Ref<FileItem[]>) {
  let dbPromise: Promise<IDBDatabase> | null = null
  let persistedIds = new Set<string>()
  let hasSyncedBaseline = false
  let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null
  let idbOperationChain: Promise<void> = Promise.resolve()

  const enqueueIdbOperation = (task: () => Promise<void>): Promise<void> => {
    const next = idbOperationChain.then(task, task)
    idbOperationChain = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  const openDatabase = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => {
        dbPromise = null
        reject(request.error)
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        db.onclose = () => {
          dbPromise = null
        }
        resolve(db)
      }
      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
    })

    return dbPromise
  }

  const closeDatabase = async () => {
    if (!dbPromise) return
    try {
      const db = await dbPromise
      db.close()
    } catch {
      // ignore close errors
    } finally {
      dbPromise = null
    }
  }

  const fileToSerializable = async (fileItem: FileItem): Promise<SerializableFile | null> => {
    try {
      const arrayBuffer = await fileItem.file.arrayBuffer()
      return {
        id: fileItem.id,
        fileName: fileItem.file.name,
        fileType: fileItem.file.type,
        fileData: arrayBuffer,
        width: fileItem.width,
        height: fileItem.height,
        cropData: fileItem.cropData,
        targetGroupId: fileItem.targetGroupId
      }
    } catch {
      return null
    }
  }

  const serializableToFile = async (data: SerializableFile): Promise<FileItem | null> => {
    try {
      const blob = new Blob([data.fileData], { type: data.fileType })
      const file = new File([blob], data.fileName, { type: data.fileType })
      const previewUrl = URL.createObjectURL(file)

      return {
        id: data.id,
        file,
        previewUrl,
        width: data.width,
        height: data.height,
        cropData: data.cropData,
        targetGroupId: data.targetGroupId
      }
    } catch (error) {
      console.error('[useFilePersistence] Failed to restore file:', error)
      return null
    }
  }

  const cancelScheduledSave = () => {
    if (pendingSaveTimer !== null) {
      clearTimeout(pendingSaveTimer)
      pendingSaveTimer = null
    }
  }

  /**
   * 增量同步 selectedFiles 到 IndexedDB（仅序列化新增项并删除移除项）
   */
  const saveSelectedFiles = async () => {
    cancelScheduledSave()
    return await enqueueIdbOperation(async () => {
      try {
        const snapshot = selectedFiles.value.slice()
        const db = await openDatabase()

        // 若尚未从 IndexedDB 建立过基线，先读取现有 keys，确保不遗留孤立数据
        if (!hasSyncedBaseline) {
          const existingKeys = await new Promise<string[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const request = tx.objectStore(STORE_NAME).getAllKeys()
            request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String))
            request.onerror = () => reject(request.error)
          })
          persistedIds = new Set(existingKeys)
          hasSyncedBaseline = true
        }

        const currentIds = new Set(snapshot.map(item => item.id))
        const idsToDelete = Array.from(persistedIds).filter(id => !currentIds.has(id))
        const itemsToPut = snapshot.filter(item => !persistedIds.has(item.id))

        if (idsToDelete.length === 0 && itemsToPut.length === 0) {
          return
        }

        // 在开启事务前并发完成新增文件的 ArrayBuffer 序列化
        const serializedItems = (
          await mapWithConcurrency(itemsToPut, SERIALIZE_CONCURRENCY, fileToSerializable)
        ).filter((item): item is SerializableFile => item !== null)

        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)

        for (const id of idsToDelete) {
          store.delete(id)
        }
        for (const item of serializedItems) {
          store.put(item)
        }

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        for (const id of idsToDelete) {
          persistedIds.delete(id)
        }
        for (const item of serializedItems) {
          persistedIds.add(item.id)
        }

        console.log(
          `[useFilePersistence] Synced IndexedDB (+${serializedItems.length}, -${idsToDelete.length}, total ${snapshot.length})`
        )
      } catch (error) {
        console.error('[useFilePersistence] Failed to save selected files:', error)
      }
    })
  }

  /**
   * 防抖保存：连续批量推入（如分批 addFiles）合并为一次增量写入
   */
  const scheduleSaveSelectedFiles = (delayMs: number = 150) => {
    cancelScheduledSave()
    pendingSaveTimer = setTimeout(() => {
      pendingSaveTimer = null
      void saveSelectedFiles()
    }, delayMs)
  }

  /**
   * 立即刷写待执行的防抖保存，并在卸载时关闭数据库连接
   */
  const flushAndDisposePersistence = async () => {
    if (pendingSaveTimer !== null) {
      await saveSelectedFiles()
    } else {
      await idbOperationChain
    }
    await closeDatabase()
  }

  /**
   * 从 IndexedDB 恢复 selectedFiles
   */
  const loadSelectedFiles = async () => {
    return await enqueueIdbOperation(async () => {
      try {
        const db = await openDatabase()
        const data = await new Promise<SerializableFile[]>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const request = tx.objectStore(STORE_NAME).getAll()
          request.onsuccess = () => resolve(request.result as SerializableFile[])
          request.onerror = () => reject(request.error)
        })

        console.log(`[useFilePersistence] Loading ${data.length} files from IndexedDB`)
        persistedIds = new Set(data.map(item => item.id))
        hasSyncedBaseline = true

        const restored = await Promise.all(data.map(item => serializableToFile(item)))
        const filtered = restored.filter((item): item is FileItem => item !== null)
        selectedFiles.value = filtered
        console.log(`[useFilePersistence] Restored ${filtered.length} files`)
      } catch (error) {
        console.error('[useFilePersistence] Failed to load selected files:', error)
      }
    })
  }

  /**
   * 清除持久化数据
   */
  const clearPersistedFiles = async () => {
    cancelScheduledSave()
    return await enqueueIdbOperation(async () => {
      try {
        const db = await openDatabase()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).clear()
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        persistedIds.clear()
        hasSyncedBaseline = true
        console.log('[useFilePersistence] Cleared persisted files from IndexedDB')
      } catch (error) {
        console.error('[useFilePersistence] Failed to clear persisted files:', error)
      }
    })
  }

  return {
    saveSelectedFiles,
    scheduleSaveSelectedFiles,
    flushAndDisposePersistence,
    loadSelectedFiles,
    clearPersistedFiles
  }
}
