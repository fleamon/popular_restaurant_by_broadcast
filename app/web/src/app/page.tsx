"use client";

import { useEffect, useMemo, useState } from "react";

import Map from "@/components/Map";
import RestaurantGrid from "@/components/RestaurantGrid";
import RestaurantList from "@/components/RestaurantList";
import ViewToggle, { type SearchView } from "@/components/ViewToggle";
import { api, type Channel, type Restaurant } from "@/lib/api";

const COUNT_COLOR = "rgb(90 97 106)";

// 채널 타입 (DB 값 ↔ 표시 라벨)
const CHANNEL_TYPES: { value: "tv" | "youtube" | "blog" | "other"; label: string }[] = [
  { value: "tv",      label: "TV" },
  { value: "youtube", label: "YouTube" },
  { value: "blog",    label: "Blog" },
  { value: "other",   label: "기타" },
];

const SIDOS = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시",
  "대전광역시", "울산광역시", "세종특별자치시", "경기도",
  "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도",
];

const CUISINES = [
  "한식", "양식", "일식", "중식", "분식", "카페",
  "베이커리", "디저트", "아시안", "패스트푸드",
];

const SELECT_CLS =
  "rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none";

export default function HomePage() {
  // 필터 상태
  const [channelType, setChannelType] = useState<string>("");
  const [channelId, setChannelId] = useState<number | "">("");
  const [sido, setSido] = useState<string>("");
  const [cuisine, setCuisine] = useState<string>("");
  const [q, setQ] = useState<string>("");

  // 데이터
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [view, setView] = useState<SearchView>("map");

  useEffect(() => {
    api.listChannels().then(setAllChannels).catch(() => setAllChannels([]));
  }, []);

  // 채널 타입 → 채널명 cascading
  const filteredChannels = useMemo(
    () => (channelType ? allChannels.filter((c) => c.channel_type === channelType) : allChannels),
    [allChannels, channelType],
  );

  // 채널 타입이 바뀌면, 현재 선택된 채널이 더이상 유효하지 않으면 리셋
  useEffect(() => {
    if (channelId !== "" && !filteredChannels.some((c) => c.id === channelId)) {
      setChannelId("");
    }
  }, [filteredChannels, channelId]);

  // 어떤 필터든 하나라도 설정되어야 결과 조회
  const hasAnyFilter = !!(channelType || channelId || sido || cuisine || q);

  const params = useMemo(
    () => ({
      channel_id:   channelId === "" ? undefined : channelId,
      channel_type: channelId === "" && channelType ? channelType : undefined, // 채널명 선택 시 타입은 무시(이미 한정됨)
      sido,
      cuisine,
      q,
    }),
    [channelType, channelId, sido, cuisine, q],
  );

  useEffect(() => {
    if (!hasAnyFilter) {
      setRows([]);
      return;
    }
    const t = setTimeout(() => {
      api.listRestaurants(params).then(setRows).catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [params, hasAnyFilter]);

  function triggerSearch() {
    if (!hasAnyFilter) return;
    api.listRestaurants(params).then(setRows).catch(() => setRows([]));
  }

  return (
    <div>
      {/* 헤더 라인 */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="font-soft text-3xl font-bold tracking-tight text-brand">맛집 검색</h1>
          <span className="font-soft text-base font-bold tracking-tight" style={{ color: COUNT_COLOR }}>
            결과 {rows.length} 개
          </span>
        </div>
        <div className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* 필터 라인 — 5개 + 검색버튼 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className={SELECT_CLS}>
          <option value="">채널 타입</option>
          {CHANNEL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value === "" ? "" : Number(e.target.value))}
          className={SELECT_CLS}
        >
          <option value="">채널명</option>
          {filteredChannels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select value={sido} onChange={(e) => setSido(e.target.value)} className={SELECT_CLS}>
          <option value="">지역별</option>
          {SIDOS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

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
          className={`min-w-[200px] flex-1 ${SELECT_CLS}`}
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

      {/* 결과 영역
          지도 모드는 검색조건이 없어도 항상 렌더 (서울 기본 중심).
          목록/격자 모드만 빈 상태일 때 안내 카드 표시. */}
      {view === "map" ? (
        <div className="h-[68vh] overflow-hidden rounded-xl border border-neutral-200">
          <Map restaurants={rows} />
        </div>
      ) : !hasAnyFilter ? (
        <EmptyState />
      ) : view === "list" ? (
        <RestaurantList rows={rows} />
      ) : (
        <RestaurantGrid rows={rows} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-[60vh] place-items-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-10 text-center">
      <div>
        <p className="text-lg font-bold text-brand">검색 조건을 선택해주세요.</p>
        <p className="mt-1 text-sm text-neutral-500">
          채널 타입 · 채널명 · 지역 · 카테고리 · 식당 이름 중 한 가지 이상이 필요합니다.
        </p>
      </div>
    </div>
  );
}
