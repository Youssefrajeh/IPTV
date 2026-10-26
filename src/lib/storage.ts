import type { ChannelData, Playlist, Settings } from '../types';

/* ---------- small settings in localStorage (wrapped: TVs/private mode can throw) ---------- */

const PREFIX = 'iptv.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: app keeps working in memory */
  }
}

export const defaultSettings: Settings = { layout: 'auto', xtreamFormat: 'm3u8', autoplayLast: false };

export const keys = {
  playlists: 'playlists',
  activePlaylist: 'activePlaylist',
  settings: 'settings',
  favorites: (pid: string) => `fav.${pid}`,
  recent: (pid: string) => `recent.${pid}`,
  lastChannel: (pid: string) => `last.${pid}`,
};

export function loadPlaylists(): Playlist[] {
  return load<Playlist[]>(keys.playlists, []);
}

/* ---------- big channel lists in IndexedDB (playlists can be 50k+ entries) ---------- */

const DB_NAME = 'iptv-player';
const STORE = 'channels';
const memory = new Map<string, ChannelData>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function saveChannels(playlistId: string, data: ChannelData): Promise<void> {
  memory.set(playlistId, data);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, playlistId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadChannels(playlistId: string): Promise<ChannelData | null> {
  const cached = memory.get(playlistId);
  if (cached) return cached;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(playlistId);
      req.onsuccess = () => {
        const data = (req.result as ChannelData) || null;
        if (data) memory.set(playlistId, data);
        resolve(data);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteChannels(playlistId: string): Promise<void> {
  memory.delete(playlistId);
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(playlistId);
  } catch {
    /* ignore */
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
