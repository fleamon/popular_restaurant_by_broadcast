"use client";

// 카카오 SDK services.Geocoder 가 반환하는 region_1depth_name 은
// "서울"·"경기" 처럼 짧은 이름. 검색 페이지의 sido 필터는
// "서울특별시"·"경기도" 같은 긴 이름이라 둘을 매핑.
const SIDO_MAP: Record<string, string> = {
  "서울": "서울특별시",
  "부산": "부산광역시",
  "대구": "대구광역시",
  "인천": "인천광역시",
  "광주": "광주광역시",
  "대전": "대전광역시",
  "울산": "울산광역시",
  "세종": "세종특별자치시",
  "경기": "경기도",
  "강원": "강원특별자치도",
  "강원도": "강원특별자치도",
  "충북": "충청북도",
  "충남": "충청남도",
  "전북": "전북특별자치도",
  "전라북도": "전북특별자치도",
  "전남": "전라남도",
  "경북": "경상북도",
  "경남": "경상남도",
  "제주": "제주특별자치도",
};

export type GeoResult = {
  lat: number;
  lng: number;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
};

type KakaoAddressItem = {
  x: string;
  y: string;
  address?: {
    region_1depth_name?: string;
    region_2depth_name?: string;
    region_3depth_name?: string;
  };
};

type KakaoServices = {
  Geocoder: new () => {
    addressSearch: (
      addr: string,
      cb: (data: KakaoAddressItem[], status: string) => void,
    ) => void;
  };
};

function getServices(): KakaoServices | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { kakao?: { maps?: { services?: KakaoServices } } };
  return w.kakao?.maps?.services ?? null;
}

/** SDK 로드 완료까지 polling — useKakaoLoader 가 이미 호출돼있다는 전제. */
async function waitForServices(timeoutMs = 5000): Promise<KakaoServices | null> {
  const start = Date.now();
  let s = getServices();
  while (!s && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
    s = getServices();
  }
  return s;
}

export async function geocode(address: string): Promise<GeoResult | null> {
  if (!address?.trim()) return null;
  const services = await waitForServices();
  if (!services) return null;
  return new Promise<GeoResult | null>((resolve) => {
    const geocoder = new services.Geocoder();
    geocoder.addressSearch(address, (data, status) => {
      if (status !== "OK" || !data || data.length === 0) {
        resolve(null);
        return;
      }
      const r = data[0];
      const region1 = r.address?.region_1depth_name ?? "";
      resolve({
        lat: Number(r.y),
        lng: Number(r.x),
        sido: SIDO_MAP[region1] ?? region1 ?? null,
        sigungu: r.address?.region_2depth_name ?? null,
        dong: r.address?.region_3depth_name ?? null,
      });
    });
  });
}
