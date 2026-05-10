// FastAPI fetch 래퍼 — 함수형, 부작용은 여기서만.

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

import { getSupabaseBrowser } from "./supabase";

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
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  // restaurants
  listRestaurants: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][],
    );
    return request<Restaurant[]>(`/restaurants?${qs}`);
  },
  topRestaurants: (limit = 10) => request<Restaurant[]>(`/restaurants/top?limit=${limit}`),
  topAppearance: (rid: number) => request<Appearance | null>(`/restaurants/${rid}/top-appearance`),
  topAppearances: (rid: number) => request<Appearance[]>(`/restaurants/${rid}/top-appearances`),
  externalInfo: (rid: number) => request<ExternalInfo>(`/restaurants/${rid}/external-info`),
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

  // votes
  vote: (body: VoteBody) =>
    request<{ ok: boolean }>(`/votes`, { method: "POST", body: JSON.stringify(body) }, true),

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

export type Channel = {
  id: number;
  name: string;
  channel_type: "tv" | "youtube" | "blog" | "other";
  platform?: string | null;
  thumbnail_url?: string | null;
  wiki_url?: string | null;
  description?: string | null;
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

export type ExternalInfo = {
  place_id: string | null;
  naver: {
    name?: string;
    category?: { category?: string };
    address?: { address?: string; roadAddress?: string };
    businessHours?: { description?: string };
    visitorReviews?: { displayText?: string };
    blogReviews?: { total?: number };
    images?: { images?: { origin: string }[] };
  } | null;
};

export type VoteBody = {
  target_type: "restaurant" | "channel" | "appearance";
  target_id: number;
  value: 1 | -1;
};

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

export type UserUpdateBody = {
  role?: "superadmin" | "admin" | "user";
  charge_channel?: string[];
  is_blocked?: boolean;
  nickname?: string;
};
