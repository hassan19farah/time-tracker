// Minimal IndexedDB wrapper. Everything stays in this browser on this device.

const DB_NAME = 'time-tracker'
const DB_VERSION = 1

export type StoreName = 'entries' | 'categories' | 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support on-device storage (IndexedDB).'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open storage.'))
    request.onblocked = () => reject(new Error('Storage is busy. Close other tabs of this app and reload.'))
  }).catch((err: unknown) => {
    dbPromise = null // allow a retry later
    throw err
  })
  return dbPromise
}

/** Runs fn inside one transaction; resolves when the transaction commits. */
async function withStores<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    const request = fn(tx)
    tx.oncomplete = () => resolve(request ? request.result : undefined)
    tx.onerror = () => reject(tx.error ?? new Error('Storage error.'))
    tx.onabort = () => reject(tx.error ?? new Error('Storage write was cancelled.'))
  })
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return ((await withStores<unknown[]>([store], 'readonly', (tx) => tx.objectStore(store).getAll())) ??
    []) as T[]
}

export async function putMany(store: StoreName, values: unknown[]): Promise<void> {
  await withStores([store], 'readwrite', (tx) => {
    const os = tx.objectStore(store)
    for (const v of values) os.put(v)
  })
}

/** Writes to several stores in one transaction: all of it is saved, or none of it. */
export async function putBatch(writes: { store: StoreName; values: unknown[] }[]): Promise<void> {
  await withStores(
    writes.map((w) => w.store),
    'readwrite',
    (tx) => {
      for (const w of writes) {
        const os = tx.objectStore(w.store)
        for (const v of w.values) os.put(v)
      }
    },
  )
}

/** Empties the stores, then writes the new values, in one transaction: all or nothing. */
export async function replaceStores(writes: { store: StoreName; values: unknown[] }[]): Promise<void> {
  await withStores(
    writes.map((w) => w.store),
    'readwrite',
    (tx) => {
      for (const w of writes) {
        const os = tx.objectStore(w.store)
        os.clear()
        for (const v of w.values) os.put(v)
      }
    },
  )
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await withStores([store], 'readwrite', (tx) => {
    tx.objectStore(store).delete(id)
  })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await withStores<unknown>(['meta'], 'readonly', (tx) => tx.objectStore('meta').get(key))) as
    | T
    | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await withStores(['meta'], 'readwrite', (tx) => {
    tx.objectStore('meta').put(value, key)
  })
}

/** Asks the browser not to clear our data under storage pressure. Best effort. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
