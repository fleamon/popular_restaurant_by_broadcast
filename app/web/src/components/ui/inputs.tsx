"use client";

/** 공용 폼 입력 위젯들 — 모든 페이지에서 동일 모양 보장.
 *  CSS 클래스는 INPUT_CLASS / TEXTAREA_CLASS / SELECT_CLASS 로 export 되어 직접 사용도 가능. */

export const INPUT_CLASS =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base font-bold text-black focus:border-brand focus:outline-none";

export const SELECT_CLASS = INPUT_CLASS;

export const TEXTAREA_CLASS =
  "w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-black focus:border-brand focus:outline-none";

/** controlled text input — 자주 쓰는 (value, onChange string) 패턴. */
export function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
      maxLength={props.maxLength}
      className={props.className ?? INPUT_CLASS}
    />
  );
}

/** controlled textarea. */
export function Textarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
      rows={props.rows ?? 4}
      maxLength={props.maxLength}
      className={props.className ?? TEXTAREA_CLASS}
    />
  );
}
