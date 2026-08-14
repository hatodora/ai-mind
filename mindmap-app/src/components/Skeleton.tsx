"use client";

/**
 * 読み込み中の骨組み（SKL-01）。
 *
 * 目的は体感待ち時間の短縮だけ。中身を精密に真似ることはしない。
 * 「これから何かが出てくる場所」と「もう少し待てばよい」ことが
 * 伝わればそれでよい。
 *
 * これまでは待ちのあいだ null を返して真っ白にしていた。
 * 何も出ないと、止まっているのか読み込み中なのか区別がつかない。
 *
 * すぐ終わる読み込みでは «出してすぐ消える» ちらつきのほうが気が散るので、
 * 最初の 0.15 秒は透明にしてある（globals.css の skeletonAppear）。
 * JS のタイマーではなく CSS で遅らせているので、
 * 速く終わった読み込みでは、そもそも一度も見えないまま外れる。
 */

/**
 * 骨組みの一片。角丸の面がゆっくり明滅する。
 *
 * 幅・高さは className で渡す（w-32 h-4 のように）。
 * 読み上げには出さない。中身の無い面を読み上げても意味がないうえ、
 * 待っていることは呼び出し側が aria-busy で伝えている。
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`skeleton block rounded-[8px] bg-skeleton ${className}`}
    />
  );
}

/**
 * 骨組みのまとまり。読み上げ利用者には「読み込み中」だけを伝える。
 * 面の一つひとつは aria-hidden なので、
 * ここで label を出さないと何も伝わらない。
 */
export function SkeletonGroup({
  label = "読み込み中",
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`skeleton-fade ${className}`}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** マップ一覧のカード（ホーム） */
export function MapCardSkeleton() {
  return (
    <div className="card-soft flex items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2.5 h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
    </div>
  );
}

/** コミュニティの投稿カード */
export function PostCardSkeleton() {
  return (
    <div className="card-soft p-5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-2.5 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-5/6" />
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** バッジの格子。実際の並びに近い数だけ置く */
export function BadgeGridSkeleton() {
  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <SkeletonGroup label="バッジを集計しています" className="mx-auto max-w-xl">
        <Skeleton className="h-[42px] w-[42px] rounded-full" />
        <Skeleton className="mt-10 h-3 w-16" />
        <Skeleton className="mt-3 h-8 w-40" />
        <Skeleton className="mt-3 h-3.5 w-52" />
        {[0, 1].map((row) => (
          <div key={row} className="mt-10">
            <Skeleton className="h-3 w-40" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card-soft p-5 text-center">
                  <Skeleton className="mx-auto h-14 w-14 rounded-full" />
                  <Skeleton className="mx-auto mt-4 h-3.5 w-20" />
                  <Skeleton className="mx-auto mt-2 h-2.5 w-full" />
                  <Skeleton className="mx-auto mt-3 h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SkeletonGroup>
    </main>
  );
}

/**
 * エディタ。操作パネルとキャンバスの二段組をそのまま骨組みにする。
 * 画面いっぱいを占める作りなので、真っ白よりも «形» が見えたほうが早く感じる。
 */
export function EditorSkeleton() {
  return (
    <SkeletonGroup
      label="マップを読み込んでいます"
      className="flex h-screen flex-col sm:flex-row"
    >
      {/* 操作パネル（デスクトップは左310px） */}
      <div className="order-3 shrink-0 bg-page p-5 sm:order-1 sm:w-[310px] sm:border-r sm:border-line">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="mt-2.5 h-5 w-2/3" />
        <Skeleton className="mt-6 h-[104px] w-full rounded-[16px]" />
        <Skeleton className="mt-4 h-[92px] w-full rounded-[16px]" />
        <Skeleton className="mt-4 h-[74px] w-full rounded-[16px]" />
      </div>
      {/* キャンバス */}
      <div className="canvas-paper order-1 flex-1 sm:order-2" />
    </SkeletonGroup>
  );
}

/** ページ全体が認証待ちのときに出す、汎用の骨組み */
export function PageSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <main className="min-h-screen bg-page px-5 py-10 sm:py-16">
      <SkeletonGroup className="mx-auto max-w-md">
        <Skeleton className="h-[42px] w-[42px] rounded-full" />
        <Skeleton className="mt-10 h-3 w-20" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-3 h-3.5 w-full" />
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="mt-7">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-[52px] w-full rounded-[12px]" />
          </div>
        ))}
      </SkeletonGroup>
    </main>
  );
}
