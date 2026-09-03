import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface Inspection {
  id?: number;
  facilityName: string;
  condition: string;
  notes: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  synced: boolean;
  timestamp: number;
}

interface SurveyDB extends DBSchema {
  inspections: {
    key: number;
    value: Inspection;
    indexes: { 'synced': number };
  };
}

let dbPromise: Promise<IDBPDatabase<SurveyDB>>;

export function initDB() {
  dbPromise = openDB<SurveyDB>('SurveyDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('inspections')) {
        const store = db.createObjectStore('inspections', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('synced', 'synced');
      }
    },
  });
}

export async function saveDraft(inspection: Inspection) {
  const db = await dbPromise;
  await db.put('inspections', inspection);
}

export async function getUnsyncedDrafts() {
  const db = await dbPromise;
  const all = await db.getAll('inspections');
  return all.filter(item => !item.synced);
}

export async function markAsSynced(id: number) {
  const db = await dbPromise;
  const item = await db.get('inspections', id);
  if (item) {
    item.synced = true;
    await db.put('inspections', item);
  }
}
