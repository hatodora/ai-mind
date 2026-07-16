import {
  type QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  writeBatch,
} from "firebase/firestore";
import type {
  Bookmark,
  CommunityComment,
  CommunityPost,
  MindMap,
  MindMapEdge,
  MindMapNode,
  UserProfile,
} from "@/types";
import { firebaseDb } from "./firebase";
import { newId } from "./storage";

/**
 * コミュニティ（NF-01b）のデータ層。
 *
 * 負荷方針（ユーザー要件: リアルタイム性と負荷低減の両立）:
 *  - フィードはページネーション付きの通常クエリ。onSnapshot は張らない
 *  - onSnapshot は「開いている投稿のコメント欄」だけ
 *  - ブックマーク一覧は非正規化データで 1 クエリ（投稿の N 回読みをしない）
 *  - commentCount はクライアントの batch＋ルール（±1のみ許可）で維持し、
 *    Cloud Functions のトリガーを使わない
 */

/** 投稿・コメントができる最低年齢（閲覧・ブックマークは全年齢） */
export const MIN_COMMUNITY_AGE = 15;
/** 1ページのフィード件数 */
export const FEED_PAGE_SIZE = 20;
/** 投稿に含められる最大ノード数（ルールと同値） */
export const MAX_POST_NODES = 200;
/** コメントの最大文字数（ルールと同値） */
export const MAX_COMMENT_LEN = 500;
/** コメント欄の購読上限 */
const COMMENTS_LIMIT = 100;

export function canPostToCommunity(profile: UserProfile | null): boolean {
  return !!profile && profile.age >= MIN_COMMUNITY_AGE;
}

/** プロフィール設定に従った投稿者名（null = 匿名） */
export function communityAuthorName(profile: UserProfile): string | null {
  return profile.showNameInCommunity ? profile.displayName : null;
}

/** null（匿名）を表示用の名前に変換する */
export function displayAuthor(name: string | null): string {
  return name ?? "匿名の思索家";
}

const postsCol = () => collection(firebaseDb(), "posts");

// ---------- 投稿の組み立て ----------

/**
 * 選択ノード＋その子孫のスナップショットを切り出す（公開単位の確定仕様）。
 * 位置は選択ノードが原点に来るよう平行移動し、ミニマップ描画に使う。
 */
export function collectSubtree(
  map: MindMap,
  rootNodeId: string,
): { nodes: MindMapNode[]; edges: MindMapEdge[] } | null {
  const root = map.nodes.find((n) => n.id === rootNodeId);
  if (!root) return null;
  const keep = new Set<string>([rootNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of map.edges) {
      if (keep.has(e.source) && !keep.has(e.target)) {
        keep.add(e.target);
        changed = true;
      }
    }
  }
  const nodes = map.nodes
    .filter((n) => keep.has(n.id))
    .slice(0, MAX_POST_NODES)
    .map((n) => ({
      ...n,
      position: {
        x: n.position.x - root.position.x,
        y: n.position.y - root.position.y,
      },
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = map.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  return { nodes, edges };
}

/** 投稿を公開する。戻り値は postId */
export async function publishPost(
  map: MindMap,
  rootNodeId: string,
  profile: UserProfile,
): Promise<string> {
  const subtree = collectSubtree(map, rootNodeId);
  if (!subtree) throw new Error("公開するノードが見つかりません");
  const root = map.nodes.find((n) => n.id === rootNodeId)!;
  const id = newId();
  const post: CommunityPost = {
    id,
    authorUid: profile.uid,
    authorName: communityAuthorName(profile),
    theme: map.theme,
    rootLabel: root.data.label,
    nodes: subtree.nodes,
    edges: subtree.edges,
    commentCount: 0,
    createdAt: Date.now(),
  };
  await setDoc(doc(postsCol(), id), post);
  return id;
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(postsCol(), postId));
}

// ---------- フィード（ページネーション・onSnapshot なし） ----------

export interface FeedPage {
  posts: CommunityPost[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function fetchPosts(
  cursor?: QueryDocumentSnapshot | null,
): Promise<FeedPage> {
  const q = cursor
    ? query(
        postsCol(),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(FEED_PAGE_SIZE + 1),
      )
    : query(
        postsCol(),
        orderBy("createdAt", "desc"),
        limit(FEED_PAGE_SIZE + 1),
      );
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > FEED_PAGE_SIZE;
  const docs = snap.docs.slice(0, FEED_PAGE_SIZE);
  return {
    posts: docs.map((d) => d.data() as CommunityPost),
    cursor: docs[docs.length - 1] ?? null,
    hasMore,
  };
}

export async function fetchPost(
  postId: string,
): Promise<CommunityPost | null> {
  const snap = await getDoc(doc(postsCol(), postId));
  return snap.exists() ? (snap.data() as CommunityPost) : null;
}

// ---------- コメント ----------

/** 開いている投稿のコメントだけをリアルタイム購読する */
export function watchComments(
  postId: string,
  onChange: (comments: CommunityComment[]) => void,
): () => void {
  const q = query(
    collection(doc(postsCol(), postId), "comments"),
    orderBy("createdAt", "asc"),
    limit(COMMENTS_LIMIT),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as CommunityComment));
  });
}

/** コメント作成。投稿の commentCount +1 と同一 batch で行う（ルールで ±1 を強制） */
export async function addComment(
  postId: string,
  text: string,
  profile: UserProfile,
): Promise<void> {
  const id = newId();
  const comment: CommunityComment = {
    id,
    authorUid: profile.uid,
    authorName: communityAuthorName(profile),
    text: text.trim().slice(0, MAX_COMMENT_LEN),
    createdAt: Date.now(),
  };
  const batch = writeBatch(firebaseDb());
  batch.set(doc(collection(doc(postsCol(), postId), "comments"), id), comment);
  batch.update(doc(postsCol(), postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  const batch = writeBatch(firebaseDb());
  batch.delete(doc(collection(doc(postsCol(), postId), "comments"), commentId));
  batch.update(doc(postsCol(), postId), { commentCount: increment(-1) });
  await batch.commit();
}

// ---------- ブックマーク（本人専用・全年齢） ----------

const bookmarksCol = (uid: string) =>
  collection(firebaseDb(), "users", uid, "bookmarks");

export async function addBookmark(
  uid: string,
  post: CommunityPost,
): Promise<void> {
  const bookmark: Bookmark = {
    postId: post.id,
    theme: post.theme,
    rootLabel: post.rootLabel,
    nodeCount: post.nodes.length,
    authorName: post.authorName,
    postCreatedAt: post.createdAt,
    createdAt: Date.now(),
  };
  await setDoc(doc(bookmarksCol(uid), post.id), bookmark);
}

export async function removeBookmark(
  uid: string,
  postId: string,
): Promise<void> {
  await deleteDoc(doc(bookmarksCol(uid), postId));
}

export async function fetchBookmarks(uid: string): Promise<Bookmark[]> {
  const snap = await getDocs(
    query(bookmarksCol(uid), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => d.data() as Bookmark);
}

export async function isBookmarked(
  uid: string,
  postId: string,
): Promise<boolean> {
  const snap = await getDoc(doc(bookmarksCol(uid), postId));
  return snap.exists();
}
