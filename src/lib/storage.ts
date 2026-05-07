import type { MindMap } from "@/types";

const STORAGE_KEY = "mindmap-app:maps";

function getAll(): Record<string, MindMap> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MindMap>) : {};
  } catch {
    return {};
  }
}

function saveAll(maps: Record<string, MindMap>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

export const storage = {
  list(): MindMap[] {
    return Object.values(getAll()).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): MindMap | null {
    return getAll()[id] ?? null;
  },
  save(map: MindMap) {
    const all = getAll();
    all[map.id] = { ...map, updatedAt: Date.now() };
    saveAll(all);
  },
  remove(id: string) {
    const all = getAll();
    delete all[id];
    saveAll(all);
  },
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
