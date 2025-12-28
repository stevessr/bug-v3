import type { Ref } from 'vue'

/**
 * 文件持久化 Composable
 * 使用 IndexedDB 存储文件，避免 localStorage 配额限制
 */

// IndexedDB 配置
const DB_NAME = 'buffer-files-db'
const DB_VERSION = 1
const STORE_NAME = 'selected-files'

// 文件项类型
export interface FileItem {
  id: string
  file: File
  previewUrl: string
  width?: number
  height?: number
  cropData?: { x: number; y: number; width: number; height: number }
}

// 序列化后的文件数据
interface SerializableFile {
  id: string
  fileName: string
  fileType: string
  fileData: ArrayBuffer
  width?: number
  height?: number
  cropData?: { x: number; y: number; width: number; height: number }
}

export function useFilePersistence(selectedFiles: Ref<FileItem[]>) {
  /**
   * 打开 IndexedDB 数据库
   */
  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
    })
  }

  /**
   * 将 File 转换为可序列化的对象（使用 ArrayBuffer 而非 base64）
   */
  const fileToSerializable = async (fileItem: FileItem): Promise<SerializableFile | null> => {
    try {
      const arrayBuffer = await fileItem.file.arrayBuffer()
      return {
        id: fileItem.id,
        fileName: fileItem.file.name,
        fileType: fileItem.file.type,
        fileData: arrayBuffer, // 直接存储 ArrayBuffer
        width: fileItem.width,
        height: fileItem.height,
        cropData: fileItem.cropData
      }
    } catch {
      return null
    }
  }

  /**
   * 从序列化对象恢复 File
   */
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
        cropData: data.cropData
      }
    } catch (error) {
      console.error('[useFilePersistence] Failed to restore file:', error)
      return null
    }
  }

  /**
   * 保存 selectedFiles 到 IndexedDB
   */
  const saveSelectedFiles = async () => {
    try {
      // 1. 预先序列化所有数据（异步操作）
      // 必须在事务开始前完成所有异步操作，因为 IDB 事务会在事件循环空闲时自动提交
      const serializedItems: SerializableFile[] = []
      for (const item of selectedFiles.value) {
        const serialized = await fileToSerializable(item)
        if (serialized) {
          serializedItems.push(serialized)
        }
      }

      // 2. 开启事务（同步操作）
      const db = await openDatabase()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      // 清空旧数据
      store.clear()

      // 保存新数据
      for (const item of serializedItems) {
        store.put(item)
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })

      console.log(`[useFilePersistence] Saved ${selectedFiles.value.length} files to IndexedDB`)
      db.close()
    } catch (error) {
      console.error('[useFilePersistence] Failed to save selected files:', error)
    }
  }

  /**
   * 从 IndexedDB 恢复 selectedFiles
   */
  const loadSelectedFiles = async () => {
    try {
      const db = await openDatabase()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      const allData = await new Promise<FileItem[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = async () => {
          const data = request.result as SerializableFile[]
          console.log(`[useFilePersistence] Loading ${data.length} files from IndexedDB`)

          const restored = await Promise.all(data.map(item => serializableToFile(item)))
          const filtered = restored.filter(item => item !== null) as FileItem[]
          resolve(filtered)
        }
        request.onerror = () => reject(request.error)
      })

      selectedFiles.value = allData
      console.log(`[useFilePersistence] Restored ${allData.length} files`)
      db.close()
    } catch (error) {
      console.error('[useFilePersistence] Failed to load selected files:', error)
    }
  }

  /**
   * 清除持久化数据
   */
  const clearPersistedFiles = async () => {
    try {
      const db = await openDatabase()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      console.log('[useFilePersistence] Cleared persisted files from IndexedDB')
      db.close()
    } catch (error) {
      console.error('[useFilePersistence] Failed to clear persisted files:', error)
    }
  }

  return {
    saveSelectedFiles,
    loadSelectedFiles,
    clearPersistedFiles
  }
}
