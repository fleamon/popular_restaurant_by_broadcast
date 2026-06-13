// FastAPI fetch 래퍼 — 함수형, 부작용은 여기서만.

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

import { getSupabaseBrowser } from "./supabase";

/** 쿼리스트링 직렬화 — undefined/"" 값은 제외. 여러 엔드포인트에서 공용. */
function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  return sp.toString();
}

async function request<T>(path: string, init?: RequestInit, withAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (withAuth) {
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  let res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  // 401 → session 만료/직후 race 가능. 한 번만 refresh 시도 후 재호출.
  if (res.status === 401 && withAuth) {
    try {
      const sb = getSupabaseBrowser();
      const { data } = await sb.auth.refreshSession();
      const token = data.session?.access_token;
      if (token) {
        headers.authorization = `Bearer ${token}`;
        res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
      }
    } catch { /* refresh 실패 — 원래 401 그대로 던짐 */ }
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** SSE 스트림 헬퍼 — `data: <json>\n\n` 이벤트를 JSON 으로 파싱해 yield. 인증 포함. */
async function* streamSSE<T>(path: string, body: unknown): AsyncGenerator<T> {
  const sb = getSupabaseBrowser();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    throw new Error(`API ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE 이벤트는 \n\n 으로 구분.
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const m = part.match(/^data:\s*(.*)$/m);
      if (!m) continue;
      try {
        yield JSON.parse(m[1]) as T;
      } catch {
        // 라인이 깨졌으면 무시
      }
    }
  }
}

export const api = {
  // restaurants
  listRestaurants: (params: Record<string, string | number | undefined>) =>
    request<Restaurant[]>(`/restaurants?${qs(params)}`),
  countRestaurants: (params: Record<string, string | number | undefined>) =>
    request<{ count: number }>(`/restaurants/count?${qs(params)}`),
  topRestaurants: () => request<Restaurant[]>(`/restaurants/top`),
  getRestaurant: (id: number) => request<Restaurant | null>(`/restaurants/${id}`),
  relatedRestaurants: (id: number) =>
    request<RelatedRestaurant[]>(`/restaurants/${id}/related`),
  listRegions: () => request<Region[]>(`/restaurants/regions`),
  regionCenter: (params: { sido?: string; sigungu?: string; dong?: string }) =>
    request<{ lat: number | null; lng: number | null }>(`/restaurants/region-center?${qs(params)}`),
  topAppearance: (rid: number) => request<Appearance | null>(`/restaurants/${rid}/top-appearance`),
  topAppearances: (rid: number) => request<Appearance[]>(`/restaurants/${rid}/top-appearances`),
  topAppearancesBatch: (ids: number[]) =>
    request<Record<string, Appearance>>(`/restaurants/top-appearances-batch`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  createRestaurant: (body: unknown) =>
    request<{ id: number }>(`/restaurants`, { method: "POST", body: JSON.stringify(body) }, true),
  updateRestaurantGeo: (
    rid: number,
    body: { lat: number; lng: number; sido?: string | null; sigungu?: string | null; dong?: string | null },
  ) =>
    request<{ ok: boolean }>(
      `/restaurants/${rid}/geo`,
      { method: "PATCH", body: JSON.stringify(body) },
      true,
    ),

  // 영상(appearance) 단위 수정/삭제 — admin 은 요청, superadmin 은 즉시 적용
  listManagedAppearances: () =>
    request<ManagedAppearance[]>(`/restaurants/appearances/managed`, undefined, true),
  getAppearance: (aid: number) =>
    request<AppearanceDetail>(`/restaurants/appearances/${aid}`, undefined, true),
  updateAppearanceNow: (aid: number, body: AppearanceEditPayload) =>
    request<{ ok: boolean }>(
      `/restaurants/appearances/${aid}`,
      { method: "PATCH", body: JSON.stringify(body) }, true,
    ),
  deleteAppearanceNow: (aid: number) =>
    request<{ ok: boolean }>(`/restaurants/appearances/${aid}`, { method: "DELETE" }, true),
  createAppearanceEditRequest: (aid: number, body: AppearanceEditPayload) =>
    request<{ id: number }>(
      `/restaurants/appearances/${aid}/edit-request`,
      { method: "POST", body: JSON.stringify(body) }, true,
    ),
  createAppearanceDeleteRequest: (aid: number, reason?: string) =>
    request<{ id: number }>(
      `/restaurants/appearances/${aid}/delete-request`,
      { method: "POST", body: JSON.stringify({ reason: reason ?? null }) }, true,
    ),
  applyRestaurantEdit: (rid: number) =>
    request<{ ok: boolean; restaurant_updated: boolean; appearance_updated: boolean }>(
      `/requests/${rid}/apply-restaurant-edit`, { method: "POST" }, true,
    ),
  applyRestaurantDelete: (rid: number) =>
    request<{ ok: boolean; deleted_appearance_id: number | null }>(
      `/requests/${rid}/apply-restaurant-delete`, { method: "POST" }, true,
    ),

  // channels
  listChannels: () => request<Channel[]>(`/channels`),
  channelRanking: () => request<RankingRow[]>(`/channels/ranking`),
  appearanceRanking: () => request<AppearanceScore[]>(`/channels/appearances/ranking`),
  trendingAppearances: () => request<AppearanceScore[]>(`/channels/appearances/trending`),
  updateChannel: (id: number, body: ChannelUpdateBody) =>
    request<{ ok: boolean }>(`/channels/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  fetchChannelThumbnail: (id: number) =>
    request<{ thumbnail_url: string }>(`/channels/${id}/fetch-thumbnail`, { method: "POST" }, true),

  // auth / me
  me: () => request<MeResponse | null>(`/auth/me`, undefined, true),
  // 회원 탈퇴 — 본인 계정 영구 삭제 (votes·bookmarks·requests CASCADE 정리)
  deleteAccount: () => request<{ ok: boolean }>(`/auth/me`, { method: "DELETE" }, true),

  // votes
  vote: (body: VoteBody) =>
    request<{ ok: boolean }>(`/votes`, { method: "POST", body: JSON.stringify(body) }, true),
  unvote: (target_type: VoteBody["target_type"], target_id: number) => {
    const qs = new URLSearchParams({ target_type, target_id: String(target_id) });
    return request<{ ok: boolean }>(`/votes?${qs}`, { method: "DELETE" }, true);
  },
  myVotes: async (target_type: VoteBody["target_type"]) => {
    // 미로그인 상태에선 호출 자체 skip — 401 폭증·콘솔 노이즈·불필요 RTT 제거.
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (!data.session?.access_token) return {} as Record<string, 1 | -1>;
    return request<Record<string, 1 | -1>>(`/votes/mine?target_type=${target_type}`, undefined, true);
  },
  voteScore: (
    target_type: VoteBody["target_type"],
    target_id: number,
    from: string, // YYYY-MM-DD (KST)
    to: string,
  ) => {
    const qs = new URLSearchParams({ target_type, target_id: String(target_id), from, to });
    return request<{ likes: number; dislikes: number; net_score: number }>(`/votes/score?${qs}`);
  },

  // bookmarks
  bookmarkIds: async () => {
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    if (!data.session?.access_token) return {} as Record<string, true>;
    return request<Record<string, true>>(`/bookmarks/mine/ids`, undefined, true);
  },
  addBookmark: (target_type: string, target_id: number) =>
    request<{ ok: boolean }>(
      `/bookmarks?target_type=${target_type}&target_id=${target_id}`,
      { method: "POST" },
      true,
    ),
  removeBookmark: (target_type: string, target_id: number) => {
    const qs = new URLSearchParams({ target_type, target_id: String(target_id) });
    return request<{ ok: boolean }>(`/bookmarks?${qs}`, { method: "DELETE" }, true);
  },
  myBookmarks: () =>
    request<{
      restaurants: { id: number; current_name: string; current_address: string }[];
      channels: { id: number; name: string; thumbnail_url: string | null }[];
      appearances: {
        id: number;
        episode_title: string | null;
        aired_at: string | null;
        restaurant_id: number | null;
        restaurant_name: string | null;
        channel_id: number | null;
        channel_name: string | null;
      }[];
    }>(`/bookmarks/mine`, undefined, true),

  // vote history
  myVoteHistory: () =>
    request<{
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
    }>(`/votes/my-history`, undefined, true),

  // period ranking — target_type 만 다른 동일 엔드포인트. 반환 타입만 분기.
  restaurantRankingByPeriod: (from?: string, to?: string) =>
    request<RankingRow[]>(`/votes/ranking?${qs({ target_type: "restaurant", from, to })}`),
  channelRankingByPeriod: (from?: string, to?: string) =>
    request<RankingRow[]>(`/votes/ranking?${qs({ target_type: "channel", from, to })}`),
  appearanceRankingByPeriod: (from?: string, to?: string) =>
    request<AppearanceScore[]>(`/votes/ranking?${qs({ target_type: "appearance", from, to })}`),

  // visits — 좌측 하단 방문자 위젯
  trackVisit: (visitor_id: string, referer?: string) =>
    request<{ ok: boolean }>(`/visits/track`, { method: "POST", body: JSON.stringify({ visitor_id, referer }) }),
  visitStats: () =>
    request<{ today: number; total: number }>(`/visits/stats`),
  visitFirstDate: () =>
    request<{ first_date: string }>(`/visits/first-date`),
  visitDaily: (days?: number, start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start && end) { qs.set("start", start); qs.set("end", end); }
    else qs.set("days", String(days ?? 30));
    return request<{ date: string; count: number }[]>(`/visits/daily?${qs}`);
  },
  visitReferers: (days?: number, start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start && end) { qs.set("start", start); qs.set("end", end); }
    else qs.set("days", String(days ?? 30));
    return request<{ referer: string; count: number }[]>(`/visits/referers?${qs}`);
  },

  // admin — channel auto-ingest (SSE)
  ingestChannel: (handle: string, max_videos: number) =>
    streamSSE<IngestEvent>(`/admin/ingest-channel`, { handle, max_videos }),

  // admin — YouTube 저장 데이터 동기화 (SSE) — 제목/썸네일 갱신 + 삭제 영상 정리
  syncYoutube: () => streamSSE<YoutubeSyncEvent>(`/admin/sync-youtube`, {}),

  // requests (요청 게시판)
  listRequests: (params: { status?: string; type?: string } = {}) => {
    const q = qs(params);
    // 로그인 안 해도 됨 — withAuth 가 토큰 없으면 헤더 안 붙임. is_mine 은 false 로 옴.
    return request<RequestSummary[]>(`/requests${q ? `?${q}` : ""}`, undefined, true);
  },
  getRequest: (id: number) =>
    request<RequestDetail>(`/requests/${id}`, undefined, true),
  createRequest: (body: CreateRequestBody) =>
    request<{ id: number }>(`/requests`, { method: "POST", body: JSON.stringify(body) }, true),
  updateRequestStatus: (id: number, status: RequestStatus) =>
    request<{ ok: boolean }>(`/requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, true),
  deleteRequest: (id: number) =>
    request<{ ok: boolean }>(`/requests/${id}`, { method: "DELETE" }, true),
  bulkDeleteRequests: (ids: number[]) =>
    request<{ ok: boolean; deleted: number }>(
      `/requests/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) }, true),
  grantRequestChannel: (id: number) =>
    request<{ ok: boolean; channel: string; added: boolean; role_upgraded: boolean; user: string | null }>(
      `/requests/${id}/grant-channel`, { method: "POST" }, true),
  listRequestComments: (id: number) =>
    request<RequestComment[]>(`/requests/${id}/comments`, undefined, true),
  createRequestComment: (id: number, body_text: string) =>
    request<{ id: number }>(`/requests/${id}/comments`, { method: "POST", body: JSON.stringify({ body: body_text }) }, true),

  // users (superadmin)
  listUsers: (q: string, page: number, pageSize = 20) => {
    const qs = new URLSearchParams({
      q: q || "",
      page: String(page),
      page_size: String(pageSize),
    });
    return request<UsersListResponse>(`/users?${qs}`, undefined, true);
  },
  updateUser: (seq: number, body: UserUpdateBody) =>
    request<{ data: unknown }>(`/users/${seq}`, { method: "PATCH", body: JSON.stringify(body) }, true),
};

export type Restaurant = {
  id: number;
  current_name: string;
  current_address: string;
  cuisine?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  lat?: number | null;
  lng?: number | null;
  naver_map_url?: string | null;
  kakao_map_url?: string | null;
  naver_place_id?: string | null;
  kakao_place_id?: string | null;
  naver_rating?: number | null;
  kakao_rating?: number | null;
  phone?: string | null;
  notes?: string | null;
  likes?: number;
  dislikes?: number;
  net_score?: number;
};

// 상세 페이지 '근처·연관 맛집' 목록 항목 (경량 — 백엔드 /restaurants/{id}/related)
export type RelatedRestaurant = {
  id: number;
  current_name: string;
  current_address: string;
  cuisine?: string | null;
  sigungu?: string | null;
};

export type Channel = {
  id: number;
  name: string;
  channel_type: "tv" | "youtube" | "blog" | "other";
  platform?: string | null;
  thumbnail_url?: string | null;
  wiki_url?: string | null;
  description?: string | null;
  likes?: number;
  dislikes?: number;
};

export type ChannelUpdateBody = {
  channel_type?: "tv" | "youtube" | "blog" | "other";
  platform?: string | null;
  wiki_url?: string | null;
  thumbnail_url?: string | null;
  description?: string | null;
};

export type Appearance = {
  id: number;
  restaurant_id: number;
  channel_id: number;
  aired_at?: string | null;
  episode_title?: string | null;
  source_url?: string | null;
  youtube_video_id?: string | null;
  thumbnail_url?: string | null;
  summary?: string | null;
  channels?: Channel | null;
  likes?: number;
  dislikes?: number;
};

export type AppearanceScore = {
  id: number;
  appearance_id: number;
  restaurant_id: number;
  channel_id: number;
  channel_name?: string | null;
  restaurant_name?: string | null;
  episode_title?: string | null;
  source_url?: string | null;
  youtube_video_id?: string | null;
  thumbnail_url?: string | null;
  aired_at?: string | null;
  likes: number;
  dislikes?: number;
  net_score?: number;
  trend_score?: number;
};

export type RankingRow = { id: number; name: string; likes: number; dislikes: number; net_score: number };

export type Region = { sido: string; sigungu: string | null; dong: string | null };

export type VoteBody = {
  target_type: "restaurant" | "channel" | "appearance";
  target_id: number;
  value: 1 | -1;
};

// 투표 UI 로컬 상태 — likes 만 표시하지만 dislikes 는 백엔드 호환을 위해 유지(레거시).
export type VoteState = { likes: number; dislikes: number; myVote: 1 | -1 | null };

export type MeResponse = {
  sequence: number;
  email: string;
  nickname: string | null;
  role: "superadmin" | "admin" | "user";
  charge_channel: string[];
  is_blocked: boolean;
  last_login_at: string | null;
};

export type UsersListResponse = {
  data: MeResponse[];
  total: number;
  page: number;
  page_size: number;
};

// 요청 게시판
export type RequestType =
  | "channel_add"
  | "admin_request"
  | "bug"
  | "etc"
  | "notice"
  | "restaurant_edit"
  | "restaurant_delete";
export type RequestStatus = "요청" | "처리중" | "완료" | "반려";
export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  channel_add:        "채널 추가요청",
  admin_request:      "관리자 요청",
  bug:                "버그 제보",
  etc:                "기타 요청",
  notice:             "공지사항",
  restaurant_edit:    "맛집/영상 수정 요청",
  restaurant_delete:  "맛집/영상 삭제 요청",
};

export type RestaurantRequestPayload = {
  // restaurant_edit — 변경 전 / 후 페어. 화면이 두 값을 나란히 비교해 보여줌.
  restaurant_before?: Record<string, unknown> | null;
  restaurant_after?:  Record<string, unknown> | null;
  appearance_before?: Record<string, unknown> | null;
  appearance_after?:  Record<string, unknown> | null;
  // restaurant_delete — 삭제 사유
  reason?: string;
} | null;

export type RequestSummary = {
  id: number;
  type: RequestType;
  status: RequestStatus;
  title: string;
  channel_id: number | null;
  author_nickname: string | null;
  created_at: string;
  is_mine: boolean;
  // 맛집/영상 수정·삭제 요청 시 채워짐 — /admin 승인 UI 에서 사용
  restaurant_id?: number | null;
  appearance_id?: number | null;
  payload?: RestaurantRequestPayload;
};

export type RequestDetail = RequestSummary & {
  author_id: number;
  content: string | null;
  channel_type: string | null;
  channel_url: string | null;
  channel_name: string | null;
  can_manage: boolean;
};

export type ManagedAppearance = {
  id: number;
  restaurant_id: number | null;
  channel_id: number | null;
  restaurant_name: string | null;
  restaurant_address: string | null;
  channel_name: string | null;
  channel_type: string | null;
  episode_title: string | null;
  source_url: string | null;
  youtube_video_id: string | null;
  aired_at: string | null;
};

export type AppearanceDetail = {
  id: number;
  restaurant_id: number;
  channel_id: number;
  episode_title: string | null;
  source_url: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  summary: string | null;
  aired_at: string | null;
  restaurants: Restaurant;
  channels: { id: number; name: string; channel_type: string };
};

export type AppearanceEditPayload = {
  title?: string;
  restaurant?: Partial<Restaurant>;
  appearance?: Partial<{
    channel_id: number;
    episode_title: string | null;
    source_url: string | null;
    youtube_video_id: string | null;
    thumbnail_url: string | null;
    summary: string | null;
    aired_at: string | null;
  }>;
};

export type CreateRequestBody = {
  type: RequestType;
  title: string;
  content?: string | null;
  channel_type?: "tv" | "youtube" | "blog" | "other" | null;
  channel_url?: string | null;
  channel_id?: number | null;
};

// 공지사항 시각 강조용 — 부드러운 골드 톤
export const NOTICE_STYLE = { color: "rgb(180 130 30)", bg: "rgb(255 248 220)" } as const;

export type RequestComment = {
  id: number;
  request_id: number;
  author_id: number;
  body: string;
  created_at: string;
  author_nickname: string | null;
  author_role: "superadmin" | "admin" | "user" | null;
};

export type UserUpdateBody = {
  role?: "superadmin" | "admin" | "user";
  charge_channel?: string[];
  is_blocked?: boolean;
  nickname?: string;
};

/** 채널 자동 수집 SSE 이벤트 — backend ingest_channel_stream 의 dict 그대로.
 * batch_start 는 프런트가 다중 핸들 처리 시 구분선 용도로 합성. */
export type IngestEvent =
  | { stage: "batch_start"; index: number; total: number; handle: string }
  | { stage: "channel"; channel: { id: number; name: string; youtube_id: string } }
  | { stage: "videos_fetched"; count: number }
  | { stage: "video_start"; i: number; n: number; video_id: string; title: string }
  | { stage: "video_extracted"; i: number; found: string[] }
  | { stage: "restaurant_saved"; video_id: string; restaurant: { id: number; name: string; address: string } }
  | { stage: "restaurant_skipped"; video_id: string; name: string; reason: string }
  | { stage: "video_done"; i: number; skip?: string }
  | { stage: "done"; summary: { videos: number; saved: number; skipped: number } }
  | { stage: "error"; message: string };

/** YouTube 동기화 SSE 이벤트 — backend youtube_sync.sync_stream 의 dict 그대로. */
export type YoutubeSyncEvent =
  | { stage: "start"; total: number }
  | { stage: "updated"; appearance_id: number; video_id: string; fields: string[] }
  | { stage: "removed"; appearance_id: number; video_id: string }
  | { stage: "removed_restaurant"; restaurant_id: number }
  | { stage: "done"; summary: { checked: number; updated: number; removed_appearances: number; removed_restaurants: number; dead_videos: number } }
  | { stage: "error"; message: string };
