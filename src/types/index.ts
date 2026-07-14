export type NodeRole = "user" | "ai" | "root";

export type Turn = "user" | "ai";

/**
 * AIアシストの強度（UP-02）。回復量と一括採用ペナルティを決める。
 * off は AI提案（ノード伸ばし）を使わないモード。
 */
export type AssistLevel = "level1" | "level2" | "level3" | "off";

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
   * AIトークンゲージ（UP-02）。単位は「クレジット」（1 AIターン = 3クレジット）。
   * 手動ノード追加でレベルに応じて回復、AIリクエストで消費。
   * 一括採用時は大きくマイナス（借金）になり得る。詳細は src/lib/gauge.ts。
   */
  aiGauge: number;
  /**
   * このマップのAIアシストレベル（UP-02）。回復量とペナルティを決める。
   * 省略時は既定（level2）扱い。作成時にプロフィール既定から引き継ぐ。
   */
  assistLevel?: AssistLevel;
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
  /** AIアシストの既定レベル（UP-02）。新規マップ作成時の初期値になる。省略時は既定 */
  assistLevel?: AssistLevel;
  role: "user" | "admin";
  createdAt: number;
  updatedAt: number;
}

export interface AISuggestion {
  label: string;
  parentId: string;
}
