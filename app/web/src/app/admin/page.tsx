"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase";

type Table = "channels" | "restaurants" | "appearances";
const TABLES: Table[] = ["channels", "restaurants", "appearances"];

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [active, setActive] = useState<Table>("channels");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setAuthorized(false);
      const { data: p } = await sb.from("profiles").select("is_admin").eq("id", data.user.id).single();
      setAuthorized(!!p?.is_admin);
    });
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const sb = getSupabaseBrowser();
    sb.from(active).select("*").order("id", { ascending: false }).limit(200).then(({ data }) => setRows(data ?? []));
  }, [active, authorized]);

  if (authorized === null) return <div className="text-sm text-neutral-500">권한 확인 중…</div>;
  if (!authorized) return <div className="text-sm text-red-500">관리자만 접근할 수 있습니다.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">DB 관리</h1>
      <div className="flex gap-1">
        {TABLES.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              active === t ? "bg-brand text-brand-fg" : "border hover:bg-neutral-50",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {rows[0] &&
                Object.keys(rows[0]).map((k) => (
                  <th key={k} className="px-3 py-2 text-left font-medium text-neutral-600">
                    {k}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-brand-surface">
                {Object.entries(r).map(([k, v]) => (
                  <td key={k} className="whitespace-nowrap px-3 py-2 text-neutral-700">
                    {v == null ? "" : String(v)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-neutral-400">행이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        * MVP: 읽기 전용 테이블 뷰. 행 추가/수정/삭제는 FastAPI <code>/admin/{`{table}`}</code> 엔드포인트에
        연결하는 모달 폼으로 확장하세요.
      </p>
    </div>
  );
}
