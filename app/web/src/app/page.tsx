"use client";

import { useEffect, useState } from "react";

import Map from "@/components/Map";
import { api, type Restaurant } from "@/lib/api";

export default function HomePage() {
  const [rows, setRows] = useState<Restaurant[]>([]);

  useEffect(() => {
    api.topRestaurants(20).then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">전국 인기 맛집</h1>
      <p className="text-sm text-neutral-500">좋아요가 많은 맛집을 지도에서 확인하세요. 핀 위에 마우스를 올려보세요.</p>
      <div className="h-[70vh] overflow-hidden rounded-xl border border-neutral-200">
        <Map restaurants={rows} />
      </div>
    </div>
  );
}
