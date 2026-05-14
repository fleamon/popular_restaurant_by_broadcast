"use client";

// admin 페이지 내부 호환성 유지를 위한 re-export.
// 신규 코드는 `@/components/ui/*` 에서 직접 가져오는 것을 권장.
export { default as Field } from "@/components/ui/Field";
export { Input, Textarea, INPUT_CLASS, TEXTAREA_CLASS, SELECT_CLASS } from "@/components/ui/inputs";

/** YouTube 다양한 URL 형식에서 video id 추출. 없으면 null. */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
