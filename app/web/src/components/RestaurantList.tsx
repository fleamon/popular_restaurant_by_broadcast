import type { Restaurant } from "@/lib/api";

export default function RestaurantList({ rows }: { rows: Restaurant[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-4 p-4 hover:bg-brand-surface">
          <div>
            <div className="font-semibold text-neutral-900">{r.current_name}</div>
            <div className="text-sm text-neutral-500">{r.current_address}</div>
            {r.cuisine && <div className="mt-1 text-xs text-neutral-400">{r.cuisine}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-neutral-500">
            {typeof r.likes === "number" && <span>👍 {r.likes}</span>}
            {r.naver_map_url && (
              <a
                href={r.naver_map_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                네이버지도
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-400">검색 결과가 없습니다.</div>;
}
