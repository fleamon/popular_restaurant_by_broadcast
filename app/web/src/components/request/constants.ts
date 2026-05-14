import type { RequestStatus, RequestType } from "@/lib/api";

export const REQUESTS_PAGE_SIZE = 10;

export const STATUSES: RequestStatus[] = ["요청", "처리중", "완료", "반려"];

export const STATUS_STYLE: Record<RequestStatus, { color: string; bg: string }> = {
  "요청":   { color: "rgb(80 95 130)",  bg: "rgb(245 247 252)" },
  "처리중": { color: "rgb(43 127 255)", bg: "rgb(235 244 255)" },
  "완료":   { color: "rgb(20 130 60)",  bg: "rgb(232 248 238)" },
  "반려":   { color: "rgb(200 40 40)",  bg: "rgb(254 235 235)" },
};

export const BASE_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: "channel_add",   label: "채널 추가요청" },
  { value: "admin_request", label: "관리자 요청" },
  { value: "bug",           label: "버그 제보" },
  { value: "etc",           label: "기타 요청" },
];

export const NOTICE_OPTION: { value: RequestType; label: string } = {
  value: "notice",
  label: "공지사항",
};
