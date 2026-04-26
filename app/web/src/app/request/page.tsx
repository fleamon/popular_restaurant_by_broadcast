"use client";

import { useState } from "react";

export default function RequestPage() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [channel, setChannel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: FastAPI 에 POST /requests 엔드포인트 추가 후 연동.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 py-12 text-center">
        <h1 className="text-2xl font-bold text-brand">요청 접수 완료 🙏</h1>
        <p className="text-neutral-600">검토 후 데이터에 반영됩니다. 감사합니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">맛집 요청</h1>
        <p className="mt-1 text-sm text-neutral-500">
          빠진 가게가 있거나 정보가 잘못된 곳을 알려주세요. 검토 후 반영합니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <Field label="가게 이름" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="주소" required>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="소개된 채널 (예: 수요미식회 / 맛상무)">
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="추가 설명 (선택)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-brand-fg hover:bg-brand-hover"
        >
          요청 보내기
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
