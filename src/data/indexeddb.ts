// src/data/indexeddb.ts
const DB_NAME = 'emoji_extension_db'
const DB_VERSION = 1
const STORE_NAME = 'emoji_data'

let db: IDBDatabase | null = null

async function openDb(): Promise<IDBDatabase> {
  if (db) {
    return db
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result
      resolve(db)
    }

    request.onerror = (event) => {
      reject('Error opening IndexedDB: ' + (event.target as IDBOpenDBRequest).error)
    }
  })
}

export async function writeData(data: any): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({ id: 'emoji_data', data })

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = (event) => {
      reject('Error writing to IndexedDB: ' + (event.target as IDBRequest).error)
    }
  })
}

export async function readData(): Promise<any> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get('emoji_data')

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result?.data)
    }

    request.onerror = (event) => {
      reject('Error reading from IndexedDB: ' + (event.target as IDBRequest).error)
    }
  })
}
