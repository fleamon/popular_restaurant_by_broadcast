import type { Restaurant } from "@/lib/api";

export default function RestaurantGrid({ rows }: { rows: Restaurant[] }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-400">검색 결과가 없습니다.</div>;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand hover:bg-brand-surface"
        >
          <div className="font-semibold text-neutral-900">{r.current_name}</div>
          <div className="mt-1 text-sm text-neutral-500 line-clamp-2">{r.current_address}</div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
            <span>{r.cuisine ?? ""}</span>
            {typeof r.likes === "number" && <span>👍 {r.likes}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
