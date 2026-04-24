import type { UserEntry, WatchStatus } from "./types";

const KEY = "anime-tracker-v1";

type Store = Record<string, UserEntry>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getEntry(malId: number): UserEntry {
  const store = read();
  return store[malId] ?? { status: null, rating: null, updatedAt: 0 };
}

export function getAllEntries(): Store {
  return read();
}

export function setStatus(malId: number, status: WatchStatus): UserEntry {
  const store = read();
  const prev = store[malId] ?? { status: null, rating: null, updatedAt: 0 };
  const next: UserEntry = { ...prev, status, updatedAt: Date.now() };
  store[malId] = next;
  write(store);
  return next;
}

export function setRating(malId: number, rating: number | null): UserEntry {
  const store = read();
  const prev = store[malId] ?? { status: null, rating: null, updatedAt: 0 };
  const next: UserEntry = { ...prev, rating, updatedAt: Date.now() };
  store[malId] = next;
  write(store);
  return next;
}
