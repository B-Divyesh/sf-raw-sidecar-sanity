import type { Inspection } from './types';

const DB_NAME = 'raw-sidecar-sanity';
const STORE = 'inspections';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInspection(inspection: Inspection): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(inspection);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function listInspections(): Promise<Inspection[]> {
  const db = await openDb();
  const inspections = await new Promise<Inspection[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Inspection[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return inspections.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pruneInspections(keep = 1): Promise<void> {
  const all = await listInspections();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    all.slice(keep).forEach((inspection) => transaction.objectStore(STORE).delete(inspection.id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function clearInspections(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
