export type NodeRole = "user" | "ai" | "root";

export type Turn = "user" | "ai";

export interface MindMapNodeData {
  label: string;
  role: NodeRole;
}

export interface MindMapNode {
  id: string;
  data: MindMapNodeData;
  position: { x: number; y: number };
  type?: string;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

/** マップの公開範囲。将来の共有機能（Phase 4）を見越した設計 */
export type MapVisibility = "private" | "shared" | "public";

/** 共有時の権限。sharedWith の値として使う */
export type ShareRole = "viewer" | "editor";

export interface MindMap {
  id: string;
  theme: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  currentTurn: Turn;
  turnCount: number;
  /**
   * AIトークンゲージ（UP-02）。
   * 手動ノード追加で +1、AI提案リクエストで -1。
   * 提案の一括採用時は (採用数 - 1) の追加ペナルティ。
   * 0 の間は AI へアクセスできない＝人間が考える番。
   */
  aiGauge: number;
  createdAt: number;
  updatedAt: number;
  /** Firestore 移行後の所有者 UID。ローカル（匿名）マップでは未設定 */
  ownerId?: string;
  /** 公開範囲。省略時は private 扱い */
  visibility?: MapVisibility;
  /** 共有相手 UID → 権限。細かいアクセス制御はセキュリティルール側で行う */
  sharedWith?: Record<string, ShareRole>;
}

/** users/{uid} に保存するプロフィール（NF-06） */
export interface UserProfile {
  uid: string;
  email: string;
  /** 未入力時はランダム生成した表示名が入る */
  displayName: string;
  /** 必須項目。UP-06（年齢別AI応答調整）で利用 */
  age: number;
  /** 任意。アバターとして扱う */
  photoURL: string | null;
  role: "user" | "admin";
  createdAt: number;
  updatedAt: number;
}

export interface AISuggestion {
  label: string;
  parentId: string;
}
