export type NodeRole = "user" | "ai" | "root";

export type Turn = "user" | "ai";

/**
 * AIアシストの強度（UP-02）。回復量と一括採用ペナルティを決める。
 * off は AI提案（ノード伸ばし）を使わないモード。
 */
export type AssistLevel = "level1" | "level2" | "level3" | "off";

/**
 * 年齢帯（UP-06）。誕生日から導出し、AIの語彙・説明の難易度を調整する。
 * essential: 5-10 / education: 11-14 / teenager: 15-17 / worker: 18+
 */
export type AgeBand = "essential" | "education" | "teenager" | "worker";

/**
 * AIパーソナリティ（UP-04）。explain / review を中心に応答トーンを変える。
 * advisor: 肯定＋指摘 / boss: 問いを突き返す / analyst: 論理・逆説・冷徹
 */
export type AIPersonality = "advisor" | "boss" | "analyst";

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
  /** AIにアイデアを相談した回数（UP-01 バッジ用。explain/review は数えない） */
  aiRequestCount?: number;
  /** 完成フラグ（UP-01）。結論レビュー後の「マップを一時的に保存する」で立つ */
  completed?: boolean;
  /** 完成した日時（UP-01） */
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Firestore 移行後の所有者 UID。ローカル（匿名）マップでは未設定 */
  ownerId?: string;
  /** 公開範囲。省略時は private 扱い */
  visibility?: MapVisibility;
  /** 共有相手 UID → 権限。細かいアクセス制御はセキュリティルール側で行う */
  sharedWith?: Record<string, ShareRole>;
  /**
   * 共有相手 UID → 表示名（NF-01a）。参加時に Cloud Functions が記録する。
   * 他人のプロフィールはルール上読めないため、表示用に非正規化しておく。
   */
  collaboratorNames?: Record<string, string>;
}

/** users/{uid} に保存するプロフィール（NF-06） */
export interface UserProfile {
  uid: string;
  email: string;
  /** 未入力時はランダム生成した表示名が入る */
  displayName: string;
  /** 必須項目。誕生日から導出して保存する（UP-06 年齢別AI応答調整で利用） */
  age: number;
  /** 誕生日（YYYY-MM-DD）。年齢帯の導出元（UP-06）。旧プロフィールには無い */
  birthDate?: string;
  /**
   * 誕生日を自分で変更した回数（SEC-01 F-1）。初回登録はカウントしない。
   * 2に達すると本人はこれ以上変更できず、管理者への問い合わせが必要になる。
   */
  birthDateEdits?: number;
  /** 任意。アバターとして扱う */
  photoURL: string | null;
  /** AIアシストの既定レベル（UP-02）。新規マップ作成時の初期値になる。省略時は既定 */
  assistLevel?: AssistLevel;
  /** AIパーソナリティ（UP-04）。省略時は advisor 扱い */
  personality?: AIPersonality;
  /** コミュニティで投稿・コメントに名前を表示するか（NF-01b）。既定 false＝匿名 */
  showNameInCommunity?: boolean;
  /**
   * 現在合意済みの利用規約バージョン（REL-03）。TERMS_VERSION と比較して
   * 再合意の要否を判定する。旧プロフィールには無いので undefined あり
   */
  termsVersion?: number;
  /** 利用規約に合意した日時（REL-03） */
  termsAcceptedAt?: number;
  role: "user" | "admin";
  createdAt: number;
  updatedAt: number;
}

export interface AISuggestion {
  label: string;
  parentId: string;
}

// ---------- コミュニティ（NF-01b） ----------

/**
 * コミュニティ投稿。公開時点のスナップショット（元マップを後で編集しても変わらない）。
 * nodes は「選択ノード＋その子孫」のみを含み、位置はミニマップ描画に使う。
 */
export interface CommunityPost {
  id: string;
  authorUid: string;
  /** null = 匿名。プロフィール設定 showNameInCommunity に従う */
  authorName: string | null;
  theme: string;
  /** 公開の起点に選んだノードのラベル */
  rootLabel: string;
  /** 投稿者が自由に付けるタイトル。省略時は表示で rootLabel を使う */
  title?: string;
  /** 投稿者が自由に書く本文。省略可 */
  body?: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  commentCount: number;
  createdAt: number;
}

/** 投稿へのコメント。既定は匿名（authorName = null） */
export interface CommunityComment {
  id: string;
  authorUid: string;
  authorName: string | null;
  text: string;
  createdAt: number;
}

/**
 * ブックマーク（users/{uid}/bookmarks/{postId}）。
 * 一覧表示に必要な情報を非正規化して持ち、投稿の N 回読みを避ける（負荷減）。
 */
export interface Bookmark {
  postId: string;
  theme: string;
  rootLabel: string;
  /** 投稿者が付けたタイトル（あれば表示で優先する） */
  title?: string;
  nodeCount: number;
  authorName: string | null;
  postCreatedAt: number;
  createdAt: number;
}
