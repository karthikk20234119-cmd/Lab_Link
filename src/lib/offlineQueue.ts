/**
 * LabLink Offline Queue — IndexedDB-based operation queue
 * Enables offline-first scan/borrow/return operations.
 * When the network is unavailable, mutations are queued in IndexedDB.
 * When connectivity is restored, the background sync hook replays them.
 */

const DB_NAME = "lablink_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_operations";

export interface OfflineOperation {
  id?: number; // auto-increment
  type: "borrow" | "return" | "scan";
  payload: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enqueue a mutation when offline. Returns the auto-generated ID.
 */
export async function enqueueOperation(
  type: OfflineOperation["type"],
  payload: Record<string, any>,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const op: OfflineOperation = {
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    const req = store.add(op);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all pending operations, ordered by creation time.
 */
export async function getPendingOperations(): Promise<OfflineOperation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove an operation after it has been successfully replayed.
 */
export async function removeOperation(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Increment the retry counter for a failed operation.
 */
export async function incrementRetry(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const op = getReq.result as OfflineOperation | undefined;
      if (!op) return resolve();
      op.retryCount += 1;
      const putReq = store.put(op);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Get count of pending operations.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all pending operations (use after bulk sync or for debugging).
 */
export async function clearAllOperations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
