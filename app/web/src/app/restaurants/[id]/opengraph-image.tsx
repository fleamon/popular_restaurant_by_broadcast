import { ImageResponse } from "next/og";

// 가게별 동적 OG 이미지 (1200×630). 카카오/트위터/검색 공유 카드용.
// 한글 렌더를 위해 Pretendard OTF 를 받아 임베드. 폰트/데이터 fetch 실패해도 500 대신
// 기본 이미지를 반환하도록 모든 단계 try/catch.
export const runtime = "nodejs";
export const alt = "백안맛지도 — 방송 맛집 지도";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf";
const BRAND = "rgb(43,127,255)";

async function getFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(FONT_URL, { next: { revalidate: 86400 } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function getInfo(id: string): Promise<{ name: string; sub: string }> {
  try {
    const res = await fetch(`${BASE}/restaurants/${id}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const r = await res.json();
      if (r?.current_name) {
        const sub = [r.sigungu, r.cuisine].filter(Boolean).join(" · ") || "방송 맛집";
        return { name: String(r.current_name), sub };
      }
    }
  } catch {
    /* fall through */
  }
  return { name: "백안맛지도", sub: "방송 맛집 지도" };
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ name, sub }, font] = await Promise.all([getInfo(id), getFont()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, color: BRAND, fontWeight: 700 }}>📍 백안맛지도</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: "rgb(20,30,80)", marginTop: 24, lineHeight: 1.1 }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 40, color: "rgb(90,97,106)", marginTop: 20 }}>{sub}</div>
        <div style={{ display: "flex", fontSize: 28, color: "rgb(150,156,166)", marginTop: 40 }}>
          방송·유튜브에 소개된 전국 맛집 지도
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Pretendard", data: font, style: "normal", weight: 700 }] : [],
    },
  );
}
