"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Map from "@/components/Map";
import Pagination from "@/components/Pagination";
import RestaurantGrid from "@/components/RestaurantGrid";
import RestaurantList from "@/components/RestaurantList";
import ViewToggle, { type SearchView } from "@/components/ViewToggle";
import { api, type Channel, type Region, type Restaurant } from "@/lib/api";
import { shareKakaoTalk } from "@/lib/kakao-share";

// 뷰별 페이지네이션 사이즈 — grid 는 5열 × 6줄 = 30
const LIST_PAGE_SIZE = 20;
const GRID_PAGE_SIZE = 30;

type Bounds = { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number };

const COUNT_COLOR = "rgb(90 97 106)";

// 채널 타입 (DB 값 ↔ 표시 라벨)
const CHANNEL_TYPES: { value: "tv" | "youtube" | "blog" | "other"; label: string }[] = [
  { value: "tv",      label: "TV" },
  { value: "youtube", label: "YouTube" },
  { value: "blog",    label: "Blog" },
  { value: "other",   label: "기타" },
];

const CUISINES = [
  "한식", "양식", "일식", "중식", "분식", "카페",
  "베이커리", "디저트", "아시안", "패스트푸드",
];

// 필터 한 줄에 모두 들어가도록 작은 사이즈 + shrink-0. 좁은 화면은 horizontal scroll 로 처리.
const SELECT_CLS =
  "shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";

const INPUT_CLS =
  "min-w-[140px] flex-1 rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";

export default function HomePage() {
  const router = useRouter();
  const sp = useSearchParams();

  // 필터 상태 — 초기값은 URL 쿼리스트링에서 (공유 링크 복원).
  // 채널/지역 필터는 datalist + 자유 텍스트 입력 → 모두 문자열 state. 백엔드가 ilike 로 매칭.
  const [channelType, setChannelType] = useState<string>(sp.get("ct") ?? "");
  const [channelName, setChannelName] = useState<string>(sp.get("cn") ?? "");
  const [sido, setSido] = useState<string>(sp.get("sido") ?? "");
  const [sigungu, setSigungu] = useState<string>(sp.get("sigungu") ?? "");
  const [dong, setDong] = useState<string>(sp.get("dong") ?? "");
  const [cuisine, setCuisine] = useState<string>(sp.get("cuisine") ?? "");
  const [q, setQ] = useState<string>(sp.get("q") ?? "");

  // 데이터
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [view, setView] = useState<SearchView>("map");
  const [page, setPage] = useState(1);
  // 지도 viewport bounds — Map 컴포넌트가 onIdle 시 통지 → 그 영역만 fetch
  const [bounds, setBounds] = useState<Bounds | null>(null);
  // 식당 내 투표 상태 — 페이지 마운트 시 fetch. List/Grid 카드에 prop 으로 전달.
  const [myR, setMyR] = useState<Record<string, 1 | -1>>({});
  useEffect(() => {
    api.myVotes("restaurant").then(setMyR).catch(() => setMyR({}));
  }, []);

  // list/grid 뷰일 때만 페이지네이션 크기 적용. map 뷰는 0 (cap/viewport 모드).
  const pageSize = view === "list" ? LIST_PAGE_SIZE : view === "grid" ? GRID_PAGE_SIZE : 0;

  // sp 가 외부 네비게이션(홈/검색 탭 클릭 → '/' 이동)으로 변하면 state 도 동기화.
  // 같은 값이면 setState 가 noop 이라 무한루프 없음.
  useEffect(() => {
    setChannelType(sp.get("ct") ?? "");
    setChannelName(sp.get("cn") ?? "");
    setSido(sp.get("sido") ?? "");
    setSigungu(sp.get("sigungu") ?? "");
    setDong(sp.get("dong") ?? "");
    setCuisine(sp.get("cuisine") ?? "");
    setQ(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
    api.listRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  // 채널 타입 → 채널명 cascading (datalist 옵션용)
  const filteredChannels = useMemo(
    () => (channelType ? allChannels.filter((c) => c.channel_type === channelType) : allChannels),
    [allChannels, channelType],
  );

  // 시도/시군구/동 cascading 옵션 — 입력값이 datalist 옵션 중 정확히 일치하면 cascading,
  // 부분 텍스트면 그 텍스트가 포함된 상위 후보 전체에 대해 하위 옵션을 모음 (ilike 와 일관).
  const sidoOptions = useMemo(
    () => Array.from(new Set(regions.map((r) => r.sido).filter(Boolean))).sort(),
    [regions],
  );
  const sigunguOptions = useMemo(() => {
    if (!sido) return Array.from(new Set(regions.map((r) => r.sigungu).filter(Boolean) as string[])).sort();
    const match = (s: string) => s.includes(sido) || sido.includes(s);
    return Array.from(new Set(
      regions.filter((r) => match(r.sido) && r.sigungu).map((r) => r.sigungu as string),
    )).sort();
  }, [regions, sido]);
  const dongOptions = useMemo(() => {
    if (!sigungu) return [];
    const sidoMatch = sido ? ((s: string) => s.includes(sido) || sido.includes(s)) : (() => true);
    const sigMatch  = (s: string) => s.includes(sigungu) || sigungu.includes(s);
    return Array.from(new Set(
      regions.filter((r) => sidoMatch(r.sido) && r.sigungu && sigMatch(r.sigungu) && r.dong)
             .map((r) => r.dong as string),
    )).sort();
  }, [regions, sido, sigungu]);

  // 어떤 필터든 하나라도 설정되어야 결과 조회
  const hasAnyFilter = !!(channelType || channelName || sido || sigungu || dong || cuisine || q);

  const params = useMemo(
    () => ({
      channel_name_like: channelName || undefined,
      channel_type:      channelType || undefined,
      sido,
      sigungu,
      dong,
      cuisine,
      q,
    }),
    [channelType, channelName, sido, sigungu, dong, cuisine, q],
  );

  // 필터 변경 시 페이지 1로 리셋 — 빈 페이지 보이지 않도록
  useEffect(() => { setPage(1); }, [channelType, channelName, sido, sigungu, dong, cuisine, q, view]);

  // count 는 항상 (필터 기준) — view/bounds 와 무관
  useEffect(() => {
    const t = setTimeout(() => {
      api.countRestaurants(params).then((r) => setTotalCount(r.count)).catch(() => setTotalCount(null));
    }, 200);
    return () => clearTimeout(t);
  }, [params]);

  // rows: view 따라 분기. map 뷰는 bounds 가 잡힌 후 fetch (onCreate 즉시 발화).
  useEffect(() => {
    let fetchParams: Record<string, string | number | undefined>;
    if (view === "map") {
      if (!bounds) return; // onCreate 통지 대기 — 짧은 첫 깜빡임은 감수
      fetchParams = {
        ...params,
        sw_lat: bounds.sw_lat,
        sw_lng: bounds.sw_lng,
        ne_lat: bounds.ne_lat,
        ne_lng: bounds.ne_lng,
      };
    } else {
      fetchParams = { ...params, page, page_size: pageSize, sort: "likes_desc" };
    }
    const t = setTimeout(() => {
      api.listRestaurants(fetchParams).then(setRows).catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [params, view, page, pageSize, bounds]);

  // 필터 → URL 쿼리스트링 동기화 (공유 가능)
  useEffect(() => {
    const qs = new URLSearchParams();
    if (channelType) qs.set("ct", channelType);
    if (channelName) qs.set("cn", channelName);
    if (sido) qs.set("sido", sido);
    if (sigungu) qs.set("sigungu", sigungu);
    if (dong) qs.set("dong", dong);
    if (cuisine) qs.set("cuisine", cuisine);
    if (q) qs.set("q", q);
    const s = qs.toString();
    router.replace(s ? `/?${s}` : "/", { scroll: false });
  }, [channelType, channelName, sido, sigungu, dong, cuisine, q, router]);

  function triggerSearch() {
    if (!hasAnyFilter) return;
    api.listRestaurants(params).then(setRows).catch(() => setRows([]));
  }

  // 지역 자체의 안정 중심점 — 백엔드가 sido/sigungu/dong 만으로 평균을 계산.
  // 채널/카테고리/이름검색 같은 비-지역 필터가 바뀌어도 이 값은 변하지 않음 → 지도 안 흔들림.
  const [regionCenter, setRegionCenter] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!sido) { setRegionCenter(null); return; }
    let cancelled = false;
    api.regionCenter({ sido, sigungu: sigungu || undefined, dong: dong || undefined })
      .then((r) => {
        if (cancelled) return;
        setRegionCenter(r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null);
      })
      .catch(() => { if (!cancelled) setRegionCenter(null); });
    return () => { cancelled = true; };
  }, [sido, sigungu, dong]);

  // 지도 중심 우선순위:
  //   1) 식당이름 검색 결과가 정확히 1건 → 그 식당으로 (좌표 있는 경우)
  //   2) 지역 필터 적용 → regionCenter
  //   3) 그 외 → undefined (Map 컴포넌트 기본값 = 서울시청)
  const mapCenter = useMemo(() => {
    if (q && rows.length === 1 && rows[0].lat != null && rows[0].lng != null) {
      return { lat: rows[0].lat, lng: rows[0].lng };
    }
    return regionCenter ?? undefined;
  }, [q, rows, regionCenter]);

  // 줌 레벨 — 좁은 필터일수록 더 확대. unique 1건이면 가장 가까운 줌.
  const mapLevel = useMemo(() => {
    if (q && rows.length === 1) return 3;
    if (dong) return 3;
    if (sigungu) return 5;
    if (sido) return 8;
    return undefined;
  }, [q, rows, dong, sigungu, sido]);

  // 카카오톡 공유 — 현재 페이지 URL 그대로(필터 포함) + 필터 요약
  async function shareCurrent() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const locationBits = [sido, sigungu, dong].filter(Boolean).join(" ");
    const filterBits = [
      locationBits,
      channelName || null,
      cuisine,
      q ? `"${q}"` : null,
    ].filter(Boolean).join(" · ");
    const title = filterBits ? `${filterBits} 맛집` : "백안맛지도 — 방송 맛집 지도";
    // 화면 헤더와 동일한 소스: totalCount(필터 기준 전체) — rows.length 는 viewport/페이지 단위라 다른 값.
    const count = totalCount ?? rows.length;
    const description = `${count}개의 맛집 결과 — 백안맛지도에서 확인하기`;
    const imageUrl = `${window.location.origin}/white_eyes_blue.png`;
    const ok = await shareKakaoTalk({ title, description, imageUrl, url });
    if (!ok) {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      alert("카카오 공유를 사용할 수 없어 링크를 복사했습니다.\n(Kakao Developers '플랫폼 → Web' 도메인 등록 확인)");
    }
  }

  return (
    <div>
      {/* 헤더 라인 */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">맛집 검색</h1>
          <span className="font-soft text-base font-bold tracking-tight" style={{ color: COUNT_COLOR }}>
            결과 {totalCount ?? rows.length} 개
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={shareCurrent}
            title="현재 필터 결과를 카카오톡으로 공유"
            className="rounded-md bg-[#FEE500] px-3 py-2 text-sm font-bold text-black hover:opacity-90"
          >
            💬 카카오 공유
          </button>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* 필터 라인 — 채널타입/채널명/시도/시군구/동/카테고리/이름검색 + 검색버튼. 한 줄 유지 + 좁으면 가로 스크롤 */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className={SELECT_CLS}>
          <option value="">채널 타입</option>
          {CHANNEL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* 채널명 — datalist + 자유 텍스트. 입력값을 channel_name_like 로 백엔드 ilike. */}
        <input
          list="dl-channel"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          placeholder="채널명"
          className={`${INPUT_CLS} min-w-[160px]`}
        />
        <datalist id="dl-channel">
          {filteredChannels.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>

        {/* 시/도 — datalist + 자유 텍스트. 상위 변경 시 하위 초기화. */}
        <input
          list="dl-sido"
          value={sido}
          onChange={(e) => { setSido(e.target.value); setSigungu(""); setDong(""); }}
          placeholder="시도"
          className={`${INPUT_CLS} min-w-[120px]`}
        />
        <datalist id="dl-sido">
          {sidoOptions.map((s) => <option key={s} value={s} />)}
        </datalist>

        {/* 시/군/구 — datalist + 자유 텍스트 */}
        <input
          list="dl-sigungu"
          value={sigungu}
          onChange={(e) => { setSigungu(e.target.value); setDong(""); }}
          placeholder="시/군/구"
          className={`${INPUT_CLS} min-w-[120px]`}
        />
        <datalist id="dl-sigungu">
          {sigunguOptions.map((s) => <option key={s} value={s} />)}
        </datalist>

        {/* 동/읍/면 — datalist + 자유 텍스트 */}
        <input
          list="dl-dong"
          value={dong}
          onChange={(e) => setDong(e.target.value)}
          placeholder="동/읍/면"
          className={`${INPUT_CLS} min-w-[120px]`}
        />
        <datalist id="dl-dong">
          {dongOptions.map((d) => <option key={d} value={d} />)}
        </datalist>

        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={SELECT_CLS}>
          <option value="">카테고리</option>
          {CUISINES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          placeholder="식당 이름"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
          className={INPUT_CLS}
        />

        <button
          type="button"
          onClick={triggerSearch}
          aria-label="검색"
          title="검색"
          className="shrink-0 hover:opacity-70 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 100"
            role="img"
            aria-label="검색"
            className="h-11 w-auto"
          >
            <rect width="200" height="100" rx="14" fill="rgb(44 66 163)" />
            <text
              x="100"
              y="50"
              fill="#FFFFFF"
              fontFamily="'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', system-ui, sans-serif"
              fontSize="50"
              fontWeight="900"
              textAnchor="middle"
              dominantBaseline="central"
            >
              검색
            </text>
          </svg>
        </button>
      </div>

      {/* 결과 영역 — 지도는 viewport bounds 기반 fetch(누락 없음), list/grid 는 페이지 단위 + 좋아요 정렬 */}
      {view === "map" ? (
        <div className="h-[68vh] overflow-hidden rounded-xl border border-neutral-200">
          <Map
            restaurants={rows}
            center={mapCenter}
            level={mapLevel}
            // onIdle 이 반복 발화해도 viewport 가 실제로 안 변하면 ref 유지 → 무의미한 fetch 방지
            onBoundsChanged={(b) =>
              setBounds((prev) => {
                if (
                  prev &&
                  Math.abs(prev.sw_lat - b.sw_lat) < 1e-6 &&
                  Math.abs(prev.sw_lng - b.sw_lng) < 1e-6 &&
                  Math.abs(prev.ne_lat - b.ne_lat) < 1e-6 &&
                  Math.abs(prev.ne_lng - b.ne_lng) < 1e-6
                ) {
                  return prev;
                }
                return b;
              })
            }
          />
        </div>
      ) : (
        <>
          {view === "list"
            ? <RestaurantList rows={rows} myVotes={myR} onMyVoteChange={(id, mv) =>
                setMyR((prev) => {
                  const next = { ...prev };
                  if (mv === null) delete next[String(id)];
                  else next[String(id)] = mv;
                  return next;
                })}
              />
            : <RestaurantGrid rows={rows} myVotes={myR} onMyVoteChange={(id, mv) =>
                setMyR((prev) => {
                  const next = { ...prev };
                  if (mv === null) delete next[String(id)];
                  else next[String(id)] = mv;
                  return next;
                })}
              />
          }
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil((totalCount ?? 0) / pageSize))}
            onChange={setPage}
            totalCount={totalCount ?? undefined}
          />
        </>
      )}
    </div>
  );
}
