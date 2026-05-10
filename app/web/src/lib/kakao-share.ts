"use client";

// Kakao JavaScript SDK — Share.sendDefault 로 카카오톡 공유.
// 지도 SDK(dapi.kakao.com/v2/maps/sdk.js) 와는 별개 스크립트.
// JS 키는 동일한 NEXT_PUBLIC_KAKAO_JS_KEY 사용.
// ⚠ Kakao Developers 앱의 '플랫폼 → Web' 에 사용 도메인(localhost:3000, 운영 도메인) 등록 필요.

type KakaoShareSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share?: {
    sendDefault: (params: ShareParams) => void;
  };
};

type ShareParams = {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons?: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
};

const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

let scriptPromise: Promise<void> | null = null;

function getKakao(): KakaoShareSDK | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Kakao?: KakaoShareSDK }).Kakao ?? null;
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (getKakao()) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("sdk_load_failed"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function ensureReady(): Promise<KakaoShareSDK | null> {
  try {
    await loadScript();
  } catch {
    return null;
  }
  const k = getKakao();
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  if (!k || !key) return null;
  if (!k.isInitialized()) {
    try { k.init(key); } catch { return null; }
  }
  return k;
}

export async function shareKakaoTalk(p: {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}): Promise<boolean> {
  const k = await ensureReady();
  if (!k?.Share?.sendDefault) return false;
  try {
    k.Share.sendDefault({
      objectType: "feed",
      content: {
        title: p.title,
        description: p.description,
        imageUrl: p.imageUrl,
        link: { mobileWebUrl: p.url, webUrl: p.url },
      },
      buttons: [
        { title: "보러 가기", link: { mobileWebUrl: p.url, webUrl: p.url } },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
