import {
  FieldPath,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
  /**
   * マップの変更を購読する（NF-01a リアルタイム共同編集）。
   * 自分の書き込みエコーは通知しない。ローカルリポジトリでは未対応（undefined）。
   * 戻り値は購読解除関数。
   */
  watch?(id: string, onChange: (map: MindMap) => void): () => void;
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
      // 自分のマップ ＋ 共有されたマップ（NF-01a）。
      // sharedWith.{uid} の複合インデックスは uid ごとに作れないため、
      // 共有分は orderBy を付けずクライアント側でまとめてソートする
      const own = query(
        mapsCol(),
        where("ownerId", "==", uid),
        orderBy("updatedAt", "desc"),
      );
      const shared = query(
        mapsCol(),
        where("visibility", "==", "shared"),
        where(new FieldPath("sharedWith", uid), "in", ["viewer", "editor"]),
      );
      const [ownSnap, sharedSnap] = await Promise.all([
        getDocs(own),
        getDocs(shared),
      ]);
      const byId = new Map<string, MindMap>();
      for (const d of [...ownSnap.docs, ...sharedSnap.docs]) {
        const m = d.data() as MindMap;
        byId.set(m.id, m);
      }
      return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      const snap = await getDoc(doc(mapsCol(), id));
      if (!snap.exists()) return null;
      const map = snap.data() as MindMap;
      // ルール上も弾かれるが、二重にアクセス権（所有 or 共有）を確認する
      const isMember = map.ownerId === uid || !!map.sharedWith?.[uid];
      return isMember || map.visibility === "public" ? map : null;
    },
    async save(map) {
      const withMeta: MindMap = {
        ...map,
        // 共有マップを editor が保存しても所有者は変えない（ルールでも強制）
        ownerId: map.ownerId ?? uid,
        visibility: map.visibility ?? "private",
        sharedWith: map.sharedWith ?? {},
        updatedAt: Date.now(),
      };
      await setDoc(doc(mapsCol(), map.id), stripUndefined(withMeta));
    },
    async remove(id) {
      await deleteDoc(doc(mapsCol(), id));
    },
    watch(id, onChange) {
      return onSnapshot(doc(mapsCol(), id), (snap) => {
        // 自分のローカル書き込みのエコーは無視する（相手の変更だけ反映）
        if (snap.metadata.hasPendingWrites) return;
        if (!snap.exists()) return;
        onChange(snap.data() as MindMap);
      });
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
