"use client";

/** 라벨 + 필수 표시 + 우측 hint 가 묶인 폼 필드 래퍼.
 *  본문(자식)에는 input/select/textarea 등 자유로운 위젯을 둠. */
export default function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm font-bold">
        <span style={{ color: "rgb(20 30 80)" }}>
          {label} {required && <span style={{ color: "rgb(200 40 40)" }}>*</span>}
        </span>
        {hint && <span className="font-normal" style={{ color: "rgb(150 160 180)" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}
