"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Pagination from "@/components/Pagination";
import VisitorChart from "@/components/VisitorChart";
import VoteButton from "@/components/VoteButton";
import { api, type VoteState } from "@/lib/api";
import { changePassword, signOut } from "@/lib/auth";
import { useMe } from "@/lib/me";
import { isSuperadmin } from "@/lib/role";

type VoteHistory = {
  restaurants: { id: number; name: string; address: string; likes: number; dislikes: number; my_likes: number; my_dislikes: number }[];
  channels: { id: number; name: string; likes: number; dislikes: number; my_likes: number; my_dislikes: number }[];
  appearances: {
    id: number;
    episode_title: string | null;
    restaurant_id: number | null;
    channel_id: number | null;
    restaurant_name: string | null;
    channel_name: string | null;
    likes: number;
    dislikes: number;
    my_likes: number;
    my_dislikes: number;
  }[];
};

type BookmarkData = {
  restaurants: { id: number; current_name: string; current_address: string }[];
  channels: { id: number; name: string; thumbnail_url: string | null }[];
  appearances: { id: number; episode_title: string | null; aired_at: string | null; restaurant_id: number | null; restaurant_name: string | null; channel_id: number | null; channel_name: string | null }[];
};

type MyVotes = Record<string, 1 | -1>;

const PAGE_SIZE = 5;

export default function MyPage() {
  const { me, loading } = useMe();
  const router = useRouter();
  const [votes, setVotes] = useState<VoteHistory | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkData | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  // 현재 투표 방향 — VoteButton 의 initialMyVote 에 사용
  const [myR, setMyR] = useState<MyVotes>({});
  const [myC, setMyC] = useState<MyVotes>({});
  const [myA, setMyA] = useState<MyVotes>({});

  // 투표 후 카운트 즉시 반영 (기간 전환 시 stale 방지)
  const [localR, setLocalR] = useState<Record<string, VoteState>>({});
  const [localC, setLocalC] = useState<Record<string, VoteState>>({});
  const [localA, setLocalA] = useState<Record<string, VoteState>>({});

  // 비밀번호 변경 UI
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 회원 탈퇴
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!me) return;
    setVotesLoading(true);
    api.myVoteHistory()
      .then(setVotes)
      .catch(() => setVotes({ restaurants: [], channels: [], appearances: [] }))
      .finally(() => setVotesLoading(false));
    setBookmarksLoading(true);
    api.myBookmarks()
      .then(setBookmarks)
      .catch(() => setBookmarks({ restaurants: [], channels: [], appearances: [] }))
      .finally(() => setBookmarksLoading(false));
    api.myVotes("restaurant").then(setMyR).catch(() => {});
    api.myVotes("channel").then(setMyC).catch(() => {});
    api.myVotes("appearance").then(setMyA).catch(() => {});
  }, [me]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: "새 비밀번호가 일치하지 않습니다." }); return; }
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: "비밀번호는 8자 이상이어야 합니다." }); return; }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await changePassword(pwCurrent, pwNew);
      setPwMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setTimeout(() => { setPwOpen(false); setPwMsg(null); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "변경에 실패했습니다.";
      setPwMsg({ ok: false, text: msg });
    } finally {
      setPwBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    const ok = window.confirm(
      "정말 회원 탈퇴하시겠습니까?\n\n계정과 함께 내 투표·북마크·게시글 기록이 모두 영구 삭제되며 복구할 수 없습니다.",
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      await signOut();
      alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
      router.replace("/");
    } catch (err: unknown) {
      alert(`탈퇴에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm font-bold text-neutral-400">불러오는 중…</div>;
  }
  if (!me) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-bold text-neutral-500">로그인이 필요한 페이지입니다.</p>
        <Link href="/auth/login" className="inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg hover:bg-brand-hover">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* 일별 방문자 추이 — superadmin 전용 (기존 /admin 에서 이동) */}
      {isSuperadmin(me) && <VisitorChart />}

      {/* 프로필 헤더 */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-surface text-brand">
            <UserIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-soft truncate text-lg font-bold tracking-tight" style={{ color: "rgb(20 30 80)" }}>
              {me.nickname ?? me.email}
            </p>
            <p className="truncate text-xs text-neutral-500">{me.email}</p>
          </div>
          {me.role !== "user" && (
            <span className="shrink-0 rounded-lg bg-brand-surface px-2.5 py-1 text-xs font-bold text-brand">
              {me.role}
            </span>
          )}
          <button
            type="button"
            onClick={() => { setPwOpen((o) => !o); setPwMsg(null); }}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:border-brand hover:text-brand transition-colors"
          >
            비밀번호 변경
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-500 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {deleting ? "탈퇴 처리 중…" : "회원 탈퇴"}
          </button>
        </div>

        {pwOpen && (
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="password"
                placeholder="현재 비밀번호"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="password"
                placeholder="새 비밀번호 확인"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pwBusy}
                className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
              >
                {pwBusy ? "변경 중…" : "변경하기"}
              </button>
              <button type="button" onClick={() => { setPwOpen(false); setPwMsg(null); }} className="shrink-0 text-sm font-bold text-neutral-400 hover:text-neutral-600">
                취소
              </button>
              {pwMsg && (
                <span className={`min-w-0 break-keep text-sm font-bold ${pwMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {pwMsg.text}
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* 2컬럼 레이아웃 — 모바일은 세로, 데스크탑은 좌(투표) / 우(북마크) */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <VotesSection
          data={votes}
          loading={votesLoading}
          myR={myR} myC={myC} myA={myA}
          localR={localR} localC={localC} localA={localA}
          setLocalR={setLocalR} setLocalC={setLocalC} setLocalA={setLocalA}
          setMyR={setMyR} setMyC={setMyC} setMyA={setMyA}
        />
        <BookmarksSection
          data={bookmarks}
          loading={bookmarksLoading}
          onRemove={(type, id) =>
            setBookmarks((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                restaurants: type === "restaurant" ? prev.restaurants.filter((r) => r.id !== id) : prev.restaurants,
                channels: type === "channel" ? prev.channels.filter((c) => c.id !== id) : prev.channels,
                appearances: type === "appearance" ? prev.appearances.filter((a) => a.id !== id) : prev.appearances,
              };
            })
          }
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 투표 기록 섹션
// ─────────────────────────────────────────────────────────────────────
function VotesSection({
  data, loading,
  myR, myC, myA,
  localR, localC, localA,
  setLocalR, setLocalC, setLocalA,
  setMyR, setMyC, setMyA,
}: {
  data: VoteHistory | null;
  loading: boolean;
  myR: MyVotes; myC: MyVotes; myA: MyVotes;
  localR: Record<string, VoteState>; localC: Record<string, VoteState>; localA: Record<string, VoteState>;
  setLocalR: React.Dispatch<React.SetStateAction<Record<string, VoteState>>>;
  setLocalC: React.Dispatch<React.SetStateAction<Record<string, VoteState>>>;
  setLocalA: React.Dispatch<React.SetStateAction<Record<string, VoteState>>>;
  setMyR: React.Dispatch<React.SetStateAction<MyVotes>>;
  setMyC: React.Dispatch<React.SetStateAction<MyVotes>>;
  setMyA: React.Dispatch<React.SetStateAction<MyVotes>>;
}) {
  const [rPage, setRPage] = useState(1);
  const [cPage, setCPage] = useState(1);
  const [aPage, setAPage] = useState(1);

  return (
    <div className="min-w-0 space-y-4">
      <h2 className="font-soft text-xl font-bold tracking-tight text-brand">내 투표 기록</h2>
      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm font-bold text-neutral-400">
          불러오는 중…
        </div>
      ) : !data || (data.restaurants.length + data.channels.length + data.appearances.length === 0) ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400">
          아직 투표 기록이 없습니다.
        </div>
      ) : (
        <>
          {data.restaurants.length > 0 && (
            <PagedSection title="맛집" total={data.restaurants.length} page={rPage} onPage={setRPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.restaurants, rPage).map((r) => {
                  const local = localR[String(r.id)];
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/restaurants/${r.id}`} className="font-soft block truncate text-sm font-bold hover:text-brand" style={{ color: "rgb(20 30 80)" }}>
                          {r.name}
                        </Link>
                        <p className="truncate text-xs text-neutral-500">{r.address}</p>
                      </div>
                      <VoteButton
                        target_type="restaurant"
                        target_id={r.id}
                        initialLikes={local?.likes ?? r.likes}
                        initialDislikes={local?.dislikes ?? r.dislikes}
                        initialMyVote={local?.myVote ?? myR[String(r.id)] ?? null}
                        onChange={(next) => {
                          setLocalR((prev) => ({ ...prev, [String(r.id)]: next }));
                          setMyR((prev) => {
                            const nxt = { ...prev };
                            if (next.myVote === null) delete nxt[String(r.id)];
                            else nxt[String(r.id)] = next.myVote;
                            return nxt;
                          });
                        }}
                        size="sm"
                      />
                    </li>
                  );
                })}
              </ul>
            </PagedSection>
          )}
          {data.channels.length > 0 && (
            <PagedSection title="채널" total={data.channels.length} page={cPage} onPage={setCPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.channels, cPage).map((c) => {
                  const local = localC[String(c.id)];
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-3">
                      <Link
                        href={`/?cn=${encodeURIComponent(c.name)}`}
                        className="font-soft min-w-0 flex-1 truncate text-sm font-bold hover:text-brand"
                        style={{ color: "rgb(20 30 80)" }}
                      >
                        {c.name}
                      </Link>
                      <VoteButton
                        target_type="channel"
                        target_id={c.id}
                        initialLikes={local?.likes ?? c.likes}
                        initialDislikes={local?.dislikes ?? c.dislikes}
                        initialMyVote={local?.myVote ?? myC[String(c.id)] ?? null}
                        onChange={(next) => {
                          setLocalC((prev) => ({ ...prev, [String(c.id)]: next }));
                          setMyC((prev) => {
                            const nxt = { ...prev };
                            if (next.myVote === null) delete nxt[String(c.id)];
                            else nxt[String(c.id)] = next.myVote;
                            return nxt;
                          });
                        }}
                        size="sm"
                      />
                    </li>
                  );
                })}
              </ul>
            </PagedSection>
          )}
          {data.appearances.length > 0 && (
            <PagedSection title="영상" total={data.appearances.length} page={aPage} onPage={setAPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.appearances, aPage).map((a) => {
                  const local = localA[String(a.id)];
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        {a.restaurant_id ? (
                          <Link href={`/restaurants/${a.restaurant_id}`} className="block truncate text-sm font-bold hover:text-brand" style={{ color: "rgb(20 30 80)" }}>
                            {a.episode_title ?? `영상 #${a.id}`}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                            {a.episode_title ?? `영상 #${a.id}`}
                          </p>
                        )}
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                          {a.channel_name && (
                            <Link
                              href={`/?cn=${encodeURIComponent(a.channel_name)}`}
                              className="max-w-[7rem] truncate rounded-md bg-brand-surface px-1.5 py-0.5 font-bold text-brand hover:opacity-80"
                            >
                              📺 {a.channel_name}
                            </Link>
                          )}
                          {a.restaurant_name && (
                            <span className="max-w-[7rem] truncate rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold text-neutral-700">
                              🍽 {a.restaurant_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <VoteButton
                        target_type="appearance"
                        target_id={a.id}
                        initialLikes={local?.likes ?? a.likes}
                        initialDislikes={local?.dislikes ?? a.dislikes}
                        initialMyVote={local?.myVote ?? myA[String(a.id)] ?? null}
                        onChange={(next) => {
                          setLocalA((prev) => ({ ...prev, [String(a.id)]: next }));
                          setMyA((prev) => {
                            const nxt = { ...prev };
                            if (next.myVote === null) delete nxt[String(a.id)];
                            else nxt[String(a.id)] = next.myVote;
                            return nxt;
                          });
                        }}
                        size="sm"
                      />
                    </li>
                  );
                })}
              </ul>
            </PagedSection>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 북마크 섹션
// ─────────────────────────────────────────────────────────────────────
function BookmarksSection({
  data,
  loading,
  onRemove,
}: {
  data: BookmarkData | null;
  loading: boolean;
  onRemove: (type: "restaurant" | "channel" | "appearance", id: number) => void;
}) {
  const [rPage, setRPage] = useState(1);
  const [cPage, setCPage] = useState(1);
  const [aPage, setAPage] = useState(1);

  return (
    <div className="min-w-0 space-y-4">
      <h2 className="font-soft text-xl font-bold tracking-tight text-brand">북마크</h2>
      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm font-bold text-neutral-400">
          불러오는 중…
        </div>
      ) : !data || (data.restaurants.length + data.channels.length + data.appearances.length === 0) ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm font-bold text-neutral-400">
          아직 북마크가 없습니다.<br />
          <span className="text-[11px] font-normal text-neutral-400">맛집·채널·영상 옆의 북마크 아이콘을 눌러 저장하세요.</span>
        </div>
      ) : (
        <>
          {data.restaurants.length > 0 && (
            <PagedSection title="맛집" total={data.restaurants.length} page={rPage} onPage={setRPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.restaurants, rPage).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/restaurants/${r.id}`} className="font-soft block truncate text-sm font-bold hover:text-brand" style={{ color: "rgb(20 30 80)" }}>
                        {r.current_name}
                      </Link>
                      <p className="truncate text-xs text-neutral-500">{r.current_address}</p>
                    </div>
                    <RemoveButton onClick={async () => { await api.removeBookmark("restaurant", r.id); onRemove("restaurant", r.id); }} />
                  </li>
                ))}
              </ul>
            </PagedSection>
          )}
          {data.channels.length > 0 && (
            <PagedSection title="채널" total={data.channels.length} page={cPage} onPage={setCPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.channels, cPage).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-3">
                    <Link
                      href={`/?cn=${encodeURIComponent(c.name)}`}
                      className="font-soft min-w-0 flex-1 truncate text-sm font-bold hover:text-brand"
                      style={{ color: "rgb(20 30 80)" }}
                    >
                      {c.name}
                    </Link>
                    <RemoveButton onClick={async () => { await api.removeBookmark("channel", c.id); onRemove("channel", c.id); }} />
                  </li>
                ))}
              </ul>
            </PagedSection>
          )}
          {data.appearances.length > 0 && (
            <PagedSection title="영상" total={data.appearances.length} page={aPage} onPage={setAPage}>
              <ul className="divide-y divide-neutral-100">
                {paginate(data.appearances, aPage).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      {a.restaurant_id ? (
                        <Link href={`/restaurants/${a.restaurant_id}`} className="block truncate text-sm font-bold hover:text-brand" style={{ color: "rgb(20 30 80)" }}>
                          {a.episode_title ?? `영상 #${a.id}`}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-bold" style={{ color: "rgb(20 30 80)" }}>
                          {a.episode_title ?? `영상 #${a.id}`}
                        </p>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                        {a.channel_name && (
                          <Link
                            href={`/?cn=${encodeURIComponent(a.channel_name)}`}
                            className="max-w-[7rem] truncate rounded-md bg-brand-surface px-1.5 py-0.5 font-bold text-brand hover:opacity-80"
                          >
                            📺 {a.channel_name}
                          </Link>
                        )}
                        {a.restaurant_name && (
                          <span className="max-w-[7rem] truncate rounded-md bg-neutral-100 px-1.5 py-0.5 font-bold text-neutral-700">
                            🍽 {a.restaurant_name}
                          </span>
                        )}
                        {a.aired_at && <span className="text-neutral-400">{a.aired_at}</span>}
                      </div>
                    </div>
                    <RemoveButton onClick={async () => { await api.removeBookmark("appearance", a.id); onRemove("appearance", a.id); }} />
                  </li>
                ))}
              </ul>
            </PagedSection>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 공통 하위 컴포넌트
// ─────────────────────────────────────────────────────────────────────
function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function PagedSection({
  title, total, page, onPage, children,
}: {
  title: string;
  total: number;
  page: number;
  onPage: (p: number) => void;
  children: React.ReactNode;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-soft text-base font-bold tracking-tight text-brand">{title}</h3>
        <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-bold text-brand">{total}</span>
      </div>
      {children}
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={onPage} />
      )}
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try { await onClick(); } catch { /* ignore */ } finally { setBusy(false); }
      }}
      disabled={busy}
      aria-label="북마크 해제"
      title="북마크 해제"
      className="shrink-0 rounded-md p-1.5 text-neutral-300 hover:text-red-500 transition-colors disabled:opacity-40"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
