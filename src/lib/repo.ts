import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { MindMap } from "@/types";
import { firebaseDb } from "./firebase";
import { storage } from "./storage";

/**
 * マップ永続化のリポジトリ層。
 * 未ログイン: localStorage（匿名マップ、30日保持）
 * ログイン済: Firestore maps/{mapId}
 *
 * zustand ストアからは getRepo() 経由で常に「今の」実装を使う。
 * 切替は AuthProvider が認証状態の変化に合わせて行う。
 */
export interface MapRepo {
  list(): Promise<MindMap[]>;
  get(id: string): Promise<MindMap | null>;
  save(map: MindMap): Promise<void>;
  remove(id: string): Promise<void>;
}

/** 匿名マップの保持期間（日）。超過分は起動時に自動削除する */
export const ANON_RETENTION_DAYS = 30;

export const localRepo: MapRepo = {
  async list() {
    return storage.list();
  },
  async get(id) {
    return storage.get(id);
  },
  async save(map) {
    storage.save(map);
  },
  async remove(id) {
    storage.remove(id);
  },
};

/** 期限切れの匿名マップを削除し、削除した件数を返す */
export function purgeExpiredAnonMaps(): number {
  const cutoff = Date.now() - ANON_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = storage.list().filter((m) => m.updatedAt < cutoff);
  for (const m of expired) storage.remove(m.id);
  return expired.length;
}

/** undefined のフィールドを落とす（Firestore は undefined を保存できない） */
function stripUndefined<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function createFirestoreRepo(uid: string): MapRepo {
  const mapsCol = () => collection(firebaseDb(), "maps");

  return {
    async list() {
      const q = query(
        mapsCol(),
        where("ownerId", "==", uid),
        orderBy("updatedAt", "desc"),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as MindMap);
    },
    async get(id) {
      const snap = await getDoc(doc(mapsCol(), id));
      if (!snap.exists()) return null;
      const map = snap.data() as MindMap;
      // ルール上も弾かれるが、二重に所有者を確認する
      return map.ownerId === uid ? map : null;
    },
    async save(map) {
      const withOwner: MindMap = {
        ...map,
        ownerId: uid,
        visibility: map.visibility ?? "private",
        sharedWith: map.sharedWith ?? {},
        updatedAt: Date.now(),
      };
      await setDoc(doc(mapsCol(), map.id), stripUndefined(withOwner));
    },
    async remove(id) {
      await deleteDoc(doc(mapsCol(), id));
    },
  };
}

// ---- 現在のリポジトリ（既定はローカル） ----

let currentRepo: MapRepo = localRepo;

export function getRepo(): MapRepo {
  return currentRepo;
}

export function setRepo(repo: MapRepo) {
  currentRepo = repo;
}
