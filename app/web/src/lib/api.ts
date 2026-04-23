// FastAPI fetch 래퍼 — 함수형, 부작용은 여기서만.

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  listRestaurants: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][],
    );
    return request<Restaurant[]>(`/restaurants?${qs}`);
  },
  topRestaurants: (limit = 10) => request<Restaurant[]>(`/restaurants/top?limit=${limit}`),
  listChannels: () => request<Channel[]>(`/channels`),
  channelRanking: () => request<RankingRow[]>(`/channels/ranking`),
  vote: (body: VoteBody, token: string) =>
    request<{ ok: boolean }>(`/votes`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
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
};

export type RankingRow = { id: number; name: string; likes: number; dislikes: number; net_score: number };

export type VoteBody = {
  target_type: "restaurant" | "channel" | "appearance";
  target_id: number;
  value: 1 | -1;
};
