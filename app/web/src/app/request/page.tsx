"use client";

import { useEffect, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import RequestForm from "@/components/request/RequestForm";
import RequestList from "@/components/request/RequestList";
import { api, type RequestStatus, type RequestSummary, type RequestType } from "@/lib/api";
import { useMe } from "@/lib/me";
import { isSuperadmin } from "@/lib/role";

/** /request — 요청 게시판.
 *  - 로그인 안내 / 작성 폼 / 목록 세 영역
 *  - 데이터 fetch 와 expanded id 만 page 가 들고, UI 는 components/request/* 로 위임. */
export default function RequestPage() {
  const { me } = useMe();
  const loggedIn = !!me;
  const superadmin = isSuperadmin(me);

  const [rows, setRows] = useState<RequestSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // 필터 — superadmin 만 UI 노출. 비어있으면 전체.
  const [typeFilter, setTypeFilter] = useState<RequestType | "">("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");

  useEffect(() => {
    api.listRequests({
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }).then(setRows).catch(() => setRows([]));
  }, [reloadKey, typeFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="요청 게시판" />

      {!loggedIn && (
        <p className="rounded-xl border border-dashed border-brand bg-brand-surface p-4 text-sm font-bold text-brand">
          로그인하면 요청 글(채널 추가요청, 관리자 요청, 버그 제보, 기타 요청)을 작성할 수 있습니다.
        </p>
      )}

      {loggedIn && (
        <RequestForm superadmin={superadmin} onCreated={() => setReloadKey((k) => k + 1)} />
      )}

      <RequestList
        rows={rows}
        loggedIn={loggedIn}
        superadmin={superadmin}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        onChanged={() => setReloadKey((k) => k + 1)}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onChangeTypeFilter={setTypeFilter}
        onChangeStatusFilter={setStatusFilter}
      />
    </div>
  );
}
