// 역할 헬퍼 — admin/superadmin 판정.
import type { MeResponse } from "./api";

export type Role = "superadmin" | "admin" | "user";

export function isAdmin(me: MeResponse | null | undefined): boolean {
  return me?.role === "admin" || me?.role === "superadmin";
}

export function isSuperadmin(me: MeResponse | null | undefined): boolean {
  return me?.role === "superadmin";
}
