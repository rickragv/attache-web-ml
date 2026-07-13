/**
 * IndexedDB persistence: embedded corpus vectors (so a reload doesn't
 * re-embed 32 documents) and user-uploaded documents.
 */
const DB_NAME = 'attache'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('vectors')) db.createObjectStore('vectors')
      if (!db.objectStoreNames.contains('userDocs')) db.createObjectStore('userDocs', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(store, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const out = fn(s)
    t.oncomplete = () => {
      db.close()
      resolve(out?.result ?? out)
    }
    t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
}

export const persistence = {
  getVectors(cacheKey) {
    return tx('vectors', 'readonly', (s) => s.get(cacheKey))
  },
  putVectors(cacheKey, payload) {
    return tx('vectors', 'readwrite', (s) => s.put(payload, cacheKey))
  },
  clearVectors() {
    return tx('vectors', 'readwrite', (s) => s.clear())
  },
  listUserDocs() {
    return tx('userDocs', 'readonly', (s) => s.getAll())
  },
  putUserDoc(doc) {
    return tx('userDocs', 'readwrite', (s) => s.put(doc))
  },
  deleteUserDoc(id) {
    return tx('userDocs', 'readwrite', (s) => s.delete(id))
  },
}
